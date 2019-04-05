import { assertUnreachable } from "./util/assertUnreachable";
import { OnchainTransactionsDao, TxnStateUpdate } from "./dao/OnchainTransactionsDao";
import { TransactionRequest, OnchainTransactionRow, RawTransaction } from "./domain/OnchainTransaction";
import * as crypto from 'crypto'
import log from './util/log'
import { default as DBEngine, SQL } from "./DBEngine";
import { default as GasEstimateDao } from "./dao/GasEstimateDao";
import { sleep, synchronized, maybe, Lock, Omit, prettySafeJson, safeJson } from "./util";
import { Container } from "./Container";
import { SignerService } from "./SignerService";
import { serializeTxn } from "./util/ethTransaction";

const LOG = log('OnchainTransactionService')

/**
 * Service for submitting and monitoring the state of onchain transactions.
 *
 * To use this from other services:
 *
 * 1. Use `sendTransaction(...)` to send a transaction. Note: this should be
 *    called from within a database transaction so as ensure onchain
 *    transactions are batched together with their corresponding offchain
 *    data:
 *
 *      const withdrawal = await withdrawalsDao.createWithdrawal(...)
 *      const txn = await onchainTransactionService.sendTransaction(cxn, {
 *        from: ...,
 *        to: withdrawal.recipient,
 *        value: withdrawal.amount,
 *      })
 *      await withdrawalsDao.setOnchainTransaction(withdrawal, txn.logicalId)
 *
 *    Note: other data models should reference the transaction's `logicalId`.
 *
 * 2. Use `awaitTransaction(...)` to wait for the transaction to succeed or
 *    fail:
 *
 *      const res = await onchainTransactionService.awaitTransaction(withdrawal.onchainTransactionId)
 *      if (res.status == 'confirmed') {
 *        ... handle confirmation ...
 *      } else {
 *        ... handle failure ...
 *      }
 *
 * 3. Additionally, a `completeCallback` can be provided as part of the metadata:
 *
 *      await onchainTransactionService.sendTransaction(..., {
 *        meta: {
 *          completeCallback: 'MyService.someCallback',
 *          ...,
 *        },
 *        ...,
 *      })
 *
 *   If the `completeCallback` is provided, it will be called when the
 *   transaction completes (ie, succeeds or fails), and passed an
 *   OnchainTransactionRow:
 *
 *      class MyService {
 *        async completionCallback(txn: OnchainTransactionRow) {
 *          LOG.info('Transaction completed:', txn)
 *        }
 *      }
 *
 *   NOTE: the callback method will block processing any other pending
 *   transactions, so be careful not to block for too long.
 *
 */
export class OnchainTransactionService {
  pollFinished = Lock.released()
  stopped: Lock = Lock.released()
  running: boolean = false

  constructor(
    private web3: any, 
    private gasEstimateDao: GasEstimateDao, 
    private onchainTransactionDao: OnchainTransactionsDao, 
    private db: DBEngine,
    private signerService: SignerService,
    private container: Container
  ) {}

  lookupCallback(name: string): (tx: OnchainTransactionRow) => Promise<void> {
    const [serviceName, methodName] = name.split('.')
    if (!serviceName || !methodName)
      throw new Error(`Invalid callback: ${name}`)

    const service = this.container.resolve(serviceName)
    const method = service[methodName]
    if (!method)
      throw new Error(`Invalid callback: method '${methodName}' does not exist on '${serviceName}'`)

    return method.bind(service)
  }

  /**
   * Sends a transaction to chain.
   *
   * Note: the ``db`` passed in must be from the context of the caller to
   * ensure that the pending transaction is inserted to the database as
   * part of the caller's transaction.
   */
  async sendTransaction(db: DBEngine, txnRequest: TransactionRequest) {
    let { meta, logicalId, ...web3TxRequest } = txnRequest
    meta = meta || {}
    logicalId = logicalId || null

    if (meta.completeCallback) {
      // Verify that the callback exists before doing anything else
      this.lookupCallback(meta.completeCallback)
    }
    
    const nonce = Math.max(
      await this.web3.eth.getTransactionCount(txnRequest.from),
      (await db.queryOne(SQL`
        select coalesce((
          select nonce from onchain_transactions_raw 
          where
            "from" = ${txnRequest.from} and
            state <> 'failed'
          order by nonce desc 
          limit 1
          for update
        ), 0) as nonce
      `)).nonce,
    )

    const gasPrice = await this.gasEstimateDao.latest()
    if (!gasPrice)
      throw new Error('gasEstimateDao.latest() returned null')

    const gasAmount = this.web3.utils.hexToNumber(
      txnRequest.gas ||
      await this.web3.eth.estimateGas({ ...web3TxRequest })
    )

    const unsignedTx: RawTransaction = {
      from: txnRequest.from,
      to: txnRequest.to,
      value: txnRequest.value || '0',
      gasPrice: this.web3.utils.toWei('' + gasPrice.fast, 'gwei'),
      gas: gasAmount,
      data: txnRequest.data || '0x',
      nonce: nonce,
    }

    LOG.info(`Unsigned transaction to send: ${JSON.stringify(unsignedTx)}`)

    const signedTx = await this.signerService.signTransaction(unsignedTx)

    // Note: this is called from within the transactional context of the caller
    const txnRow = await this.onchainTransactionDao.insertTransaction(db, logicalId, meta, signedTx)
    await db.onTransactionCommit(() => this.poll())

    return txnRow
  }

  async start() {
    LOG.info(`Starting OnchainTransactionService...`)
    this.runPoller()
  }

  @synchronized('stopped')
  async runPoller(pollInterval: number = 1000) {
    this.running = true
    while (this.running) {
      try {
        await this.poll()
        if (this.running)
          await sleep(pollInterval)
      } catch (e) {
        LOG.error(`Error polling pending transactions (will retry in 30s): ${'' + e}\n${e.stack}`)
        if (this.running)
          await sleep(30 * 1000)
      }
    }
  }

  async stop() {
    if (!this.running)
      return
    LOG.info('Stopping transaction poller...')
    this.running = false
    await this.stopped
    LOG.info('Transaction poller stopped.')
  }

  @synchronized('pollFinished')
  async poll() {
    for (const txn of await this.onchainTransactionDao.getPending(this.db)) {
      await this.processPendingTxn(txn)
    }
  }

  /**
   * 
   * Internal function to send the signed transaction to chain and handle the possible
   * error response.
   */
  private async submitToChain(txn: OnchainTransactionRow): Promise<void> {
    const error = await new Promise<string | null>(res => {
      LOG.info(`Submitting transaction nonce=${txn.nonce} hash=${txn.hash}: ${prettySafeJson(txn)}...`)
      
      const tx = this.web3.eth.sendSignedTransaction(serializeTxn(txn))
      tx.on('transactionHash', () => res(null))
      tx.on('error', err => res('' + err))
    })

    const errorReason = this.getErrorReason(error)
    LOG.info('Transaction nonce={txn.nonce} hash={hash} sent: {txn.hash}: {res}', {
      txn,
      hash: txn.hash,
      res: error ? '' + error + ` (${errorReason})`: 'ok!',
    })

    if (!error || errorReason == 'already-imported') {
      await this.updateTxState(txn, {
        state: 'submitted',
      })
      return
    }

    switch (errorReason) {
      case 'permanent':
        // In the future we'll be able to be more intelligent about retrying (ex,
        // with a new nonce or more gas) here... but for now, just fail.
        LOG.error(`Permanent error sending transaction: ${error}. Transaction: ${prettySafeJson(txn)}, marking as pending_failure`)
        await this.updateTxState(txn, {
          state: 'pending_failure',
          reason: errorReason
        })
        break

      case 'temporary':
        // If the error is temporary (ex, network error), do nothing; this txn
        // will be retried on the next loop.
        LOG.warning(`Temporary error while submitting tx '${txn.hash}': ${'' + error} (will retry)`)
        break

      case 'unknown':
        LOG.error(
          `Unknown error sending transaction! Refusing to do anything until ` +
          `this error is added to 'OnchainTransactionService.knownTxnErrorMessages': ` +
          `${error}`
        )
        break

      default:
        assertUnreachable(errorReason, 'unexpected error reason: ' + errorReason)
    }
  }

  private async processPendingTxn(txn: OnchainTransactionRow): Promise<void> {
    if (txn.state == 'new') {
      await this.submitToChain(txn)
      return
    }

    if (txn.state == 'submitted') {
      const [tx, err] = await maybe(this.web3.eth.getTransaction(txn.hash))
      LOG.info('State of {txn.hash}: {res}, currently submitted', {
        txn,
        res: JSON.stringify(tx || err),
      })
      if (err) {
        // TODO: what errors can happen here?
        LOG.warning(`Error checking status of tx '${txn.hash}': ${'' + err} (will retry)`)
        return
      }

      const txnAgeS = (Date.now() - (+new Date(txn.submittedOn))) / 1000
      const txnAge = `${Math.floor(txnAgeS / 60)}m ${Math.floor(txnAgeS % 60)}s`

      // not in mempool yet
      if (!tx) {
        // resubmit after 10 seconds of waiting
        if (txnAgeS > 10) {
          // should reset the submit time
          await this.submitToChain(txn)
        }
        // retry on next poll
        return
      }

      // in mempool
      if (!tx.blockNumber) {
        // fail after a long time in mempool
        //
        // Strictly speaking, this is not 100% safe. In reality we should
        // also be checking to see if there's another confirmed transaction
        // with an equal or higher nonce too... but this is probably safe for
        // now.
        if (txnAgeS > 60 * 15) {
          LOG.warning(`Transaction '${txn.hash}' has been unconfirmed for ${txnAge}; marking failed.`)
          await this.updateTxState(txn, {
            state: 'failed',
            reason: `timeout (${txnAge})`,
          })
          return
        }

        LOG.info(`Pending transaction '${txn.hash}' not yet confirmed (age: ${txnAge})`)
        return
      }

      // has block
      const [txReceipt, errReceipt] = await maybe(this.web3.eth.getTransactionReceipt(txn.hash))
      if (errReceipt) {
        // TODO: what errors can happen here?
        LOG.warning(`Error checking status of tx '${txn.hash}': ${'' + errReceipt} (will retry)`)
        return
      }
      if (!txReceipt) {
        return
      }

      // otherwise we have both tx and blockNumber, so we can put a final state
      await this.updateTxState(txn, {
        state: txReceipt.status ? 'confirmed' : 'failed',
        blockNum: txReceipt.blockNumber,
        blockHash: txReceipt.blockHash,
        transactionIndex: txReceipt.transactionIndex,
        reason: txReceipt.status ? null : 'EVM revert',
      })

      return
    }

    if (txn.state == 'pending_failure') {
      const [tx, err] = await maybe(this.web3.eth.getTransaction(txn.hash))
      LOG.info('State of {txn.hash}, currently pending_failure: {res}', {
        txn,
        res: JSON.stringify(tx || err),
      })
      if (err) {
        // TODO: what errors can happen here?
        LOG.warning(`Error checking status of tx '${txn.hash}': ${'' + err} (will retry)`)
        return
      }

      if (tx) {
        // if tx exists at this point, mark as submitted
        await this.updateTxState(txn, {
          state: 'submitted',
        })
        return
      } else {
        // if it doesn't exist, it's not in the mempool, resubmit
        await this.submitToChain(txn)
      }

      // get age to compare poll times
      const txnAgeS = (Date.now() - (+new Date(txn.pendingFailureOn))) / 1000
      const txnAge = `${Math.floor(txnAgeS / 60)}m ${Math.floor(txnAgeS % 60)}s`

      const latestConfirmed = await this.onchainTransactionDao.getLatestConfirmed(this.db, txn.from)
      if (latestConfirmed && latestConfirmed.nonce > txn.nonce) {
        LOG.warning(`Transaction '${txn.hash}' is invalidated by a higher confirmed nonce: ${latestConfirmed.nonce}; marking as failed.`)
        await this.updateTxState(txn, {
          state: 'failed',
          reason: `higher confirmed nonce by txn id: ${txn.id}`,
        })
        return
      }

      // if polled for 54 seconds and still nothing, mark as failed
      if (txnAgeS > 6 * 9) {
        LOG.warning(`Transaction '${txn.hash}' has been pending_failure for ${txnAge}; marking failed.`)
        await this.updateTxState(txn, {
          state: 'failed',
          reason: `timeout (${txnAge})`,
        })
        return
      }
      return
    }

    // This really shouldn't happened, but it's safe to ignore if it does.
    if (txn.state == 'confirmed' || txn.state == 'failed')
      return

    assertUnreachable(txn.state, 'unexpected txn.state:')

  }

  private async updateTxState(txn: OnchainTransactionRow, state: TxnStateUpdate) {
    txn = await this.onchainTransactionDao.updateTransactionState(this.db, txn.id, state)
    if ((txn.state == 'confirmed' || txn.state == 'failed') && txn.meta.completeCallback) {
      const callback = this.lookupCallback(txn.meta.completeCallback)
      await new Promise(async res => {
        const timeout = setTimeout(() => {
          LOG.error('Txn complete callback {callbackName} taking too long to process txn {txn}!', {
            callbackName: txn.meta.completeCallback,
            txn,
          })
          res()
        }, 30 * 1000)
        try {
          await callback(txn)
        } finally {
          clearTimeout(timeout)
          res()
        }
      })
    }
  }

  /**
   * Waits for the transaction to complete (ie, it's confirmed or failed), then
   * return it.
   */
  async awaitTransaction(logicalId: Number): Promise<OnchainTransactionRow> {
    while (true) {
      const txn = await this.onchainTransactionDao.getTransactionByLogicalId(this.db, logicalId)
      if (txn.state == 'failed' || txn.state == 'confirmed')
        return txn
      await this.pollFinished
    }
  }

  knownTxnErrorMessages = {
    'known transaction:': 'already-imported',
    'same hash was already imported': 'already-imported',
    'nonce too low': 'permanent',
    'nonce is too low': 'permanent',
    'replacement transaction underpriced': 'permanent',
    'does not have enough funds': 'permanent',
    'Invalid JSON RPC response:': 'temporary',
    'insufficient funds for gas * price + value': 'permanent',
    'another transaction with same nonce in the queue': 'permanent'
  }

  getErrorReason(errMsg: string): null | 'already-imported' | 'permanent' | 'temporary' | 'unknown' {
    if (!errMsg)
      return null
    for (const key in this.knownTxnErrorMessages) {
      if (errMsg.indexOf(key) >= 0)
        return this.knownTxnErrorMessages[key]
    }

    return 'unknown'
  }
}
