import * as connext from 'connext'
import {
  ChannelState,
  ConfirmPendingArgs,
  EmptyChannelArgs,
} from 'connext/types'
import Web3 from 'web3'

import Config from './Config'
import { ChannelManager } from './contract/ChannelManager'
import ChainsawDao, { PollType } from './dao/ChainsawDao'
import ChannelDisputesDao from './dao/ChannelDisputesDao'
import ChannelsDao from './dao/ChannelsDao'
import { default as DBEngine } from './DBEngine'
import {
  ContractEvent,
  DidEmptyChannelEvent,
  DidHubContractWithdrawEvent,
  DidStartExitChannelEvent,
  DidUpdateChannelEvent,
  EventLog,
} from './domain/ContractEvent'
import { OnchainTransactionService } from './OnchainTransactionService'
import { RedisClient } from './RedisClient'
import { SignerService } from './SignerService'
import { Logger, prettySafeJson, safeJson, sleep } from './util'

const CONFIRMATION_COUNT = 3
const POLL_INTERVAL = 1000

export default class ChainsawService {
  private log: Logger
  constructor(
    private signerService: SignerService,
    private onchainTransactionService: OnchainTransactionService,
    private chainsawDao: ChainsawDao,
    private channelsDao: ChannelsDao,
    private channelDisputesDao: ChannelDisputesDao,
    private contract: ChannelManager,
    private web3: Web3,
    private utils: connext.Utils,
    private config: Config,
    private db: DBEngine,
    public validator: connext.Validator,
    public redis: RedisClient,
  ) {
    this.log = new Logger('ChainsawService', this.config.logLevel)
  }

  public async poll(): Promise<void> {
    while (true) {
      const start = Date.now()
      await this.pollOnce()
      const elapsed = Date.now() - start
      this.log.debug(`Spent ${elapsed} ms polling`)
      if (elapsed < POLL_INTERVAL) {
        await sleep(POLL_INTERVAL - elapsed)
      }
    }
  }

  public async pollOnce(): Promise<void> {
    try {
      await this.db.withTransaction(() => this.doFetchEvents())
    } catch (e) {
      this.log.error(`Fetching events failed: ${e}`)
    }
    try {
      await this.db.withTransaction(() => this.doProcessEvents())
    } catch (e) {
      this.log.error(`Processing events failed: ${e}`)
    }
  }

  /**
   * Process a single transaction by hash. Can be used by scripts that need to force a re-process.
   */
  async processSingleTx(txHash: string, force: boolean = false): Promise<PollType> {
    const event = await this.chainsawDao.eventByHash(txHash)
    const prettyEvent = {}
    Object.keys(event).forEach((prop: string): void => {
      prettyEvent[prop] = event[prop].toString()
    })
    this.log.info(`Processing event: ${JSON.stringify(prettyEvent, undefined, 2)}`)

    let res
    switch (event.TYPE) {
      case DidHubContractWithdrawEvent.TYPE:
        break
      case DidUpdateChannelEvent.TYPE:
        res = await this.processDidUpdateChannel(event.chainsawId, event as DidUpdateChannelEvent, force)
        break
      case DidStartExitChannelEvent.TYPE:
        await this.processDidStartExitChannel(event.chainsawId, event as DidStartExitChannelEvent)
        break
      case DidEmptyChannelEvent.TYPE:
        try {
          await this.db.withTransaction({ savepoint: true }, () => {
            return this.processDidEmptyChannel(event.chainsawId, event as DidEmptyChannelEvent)
          })
        } catch (e) {
          this.log.error(`Error processing DidEmptyChannelEvent (IGNORING THIS FOR NOW): ${'' + e}\n${e.stack}`)
        }
        break
      default:
        this.log.info(`Got type { type: ${event.TYPE} }. Not implemented yet.`)
        break
    }
    return res ? res : 'PROCESS_EVENTS'
  }

  private async doFetchEvents() {
    const topBlock = await this.web3.eth.getBlockNumber()
    // @ts-ignore
    const last = await this.chainsawDao.lastPollFor(this.contract.address, 'FETCH_EVENTS')
    const lastBlock = last.blockNumber
    let toBlock = topBlock - CONFIRMATION_COUNT
    // enforce limit of polling 10k blocks at a time
    if (toBlock - lastBlock > 10000) {
      toBlock = lastBlock + 10000
    }

    // need to check for >= here since we were previously not checking for a confirmation count
    if (lastBlock >= toBlock) {
      if (lastBlock > toBlock) {
        this.log.info(`lastBlock: ${lastBlock} > toBlock: ${toBlock}`)
      }
      return
    }

    const fromBlock = lastBlock + 1

    this.log.info(`Synchronizing chain data between blocks ${fromBlock} and ${toBlock}`)

    // @ts-ignore
    const events = await this.contract.getPastEvents('allEvents', {
      fromBlock,
      toBlock
    })

    const blockIndex = {} as any
    const txsIndex = {} as any

    events.forEach((e: EventLog) => {
      blockIndex[e.blockNumber] = true
      txsIndex[e.transactionHash] = true
    })

    await Promise.all(Object.keys(blockIndex).map(async (n: string) => {
      blockIndex[n] = await this.web3.eth.getBlock(n)
    }))

    await Promise.all(Object.keys(txsIndex).map(async (txHash: string) => {
      txsIndex[txHash] = await this.web3.eth.getTransaction(txHash)
    }))

    const channelEvents: ContractEvent[] = events.map((event: EventLog) => {
      return ContractEvent.fromRawEvent({
        log: event,
        txIndex: event.transactionIndex,
        logIndex: event.logIndex,
        // @ts-ignore
        contract: this.contract.address,
        sender: txsIndex[event.transactionHash].from,
        timestamp: blockIndex[event.blockNumber].timestamp * 1000
      })
    })

    if (channelEvents.length) {
      this.log.info(`Inserting new transactions: ${channelEvents.map((e: ContractEvent) => e.txHash)}`)
      // @ts-ignore
      await this.chainsawDao.recordEvents(channelEvents, toBlock, this.contract.address)
      this.log.debug(`Successfully inserted ${channelEvents.length} transactions.`)
    } else {
      this.log.debug('No new transactions found; nothing to do.')
      // @ts-ignore
      await this.chainsawDao.recordPoll(toBlock, null, this.contract.address, 'FETCH_EVENTS')
    }
  }

  private async doProcessEvents() {
    // should look for either successfully processed, or
    // last skipped events
    // @ts-ignore
    const last = await this.chainsawDao.lastProcessEventPoll(this.contract.address)
    // @ts-ignore
    const ingestedEvents = await this.chainsawDao.eventsSince(this.contract.address, last.blockNumber, last.txIndex)

    if (!ingestedEvents.length) {
      return
    }

    for (let event of ingestedEvents) {
      // returns either 'PROCESS_EVENTS' or 'SKIP_EVENTS' or 'RETRY
      const pollType = await this.processSingleTx(event.event.txHash)

      // return on retry so we can retry on the next polling loop
      if (pollType == 'RETRY') return

      await this.chainsawDao.recordPoll(
        event.event.blockNumber,
        event.event.txIndex,
        // @ts-ignore
        this.contract.address,
        pollType,
      )
    }
  }

  private async processDidUpdateChannel(chainsawId: number, event: DidUpdateChannelEvent, force: boolean = false): Promise<PollType> {
    if (event.txCountGlobal > 1) {
      const knownEvent = await this.channelsDao.getChannelUpdateByTxCount(
        event.user,
        event.txCountGlobal,
      )
      if (!knownEvent) {
        // This means there is an event on chain which we don't have a copy of
        // in our database. This is a Very Big Problem, so crash hard here
        // and handle it manually.
        const msg = (
          `CRITICAL: Event broadcast on chain, but not found in the database. ` +
          `This should never happen! Event body: ${JSON.stringify(event)}`
        )
        this.log.error(msg)
        if (this.config.isProduction)
          throw new Error(msg)
        return
      }

      if (knownEvent.invalid) {
        const msg = (
          `CRITICAL: Event broadcast on chain, but our version has been invalidated. ` +
          `This should never happen! Event body: ${JSON.stringify(event)}`
        )
        this.log.error(msg)
        if (this.config.isProduction)
          throw new Error(msg)
        return
      }
    }

    const prev = await this.channelsDao.getChannelOrInitialState(event.user)
    if (prev.status == "CS_CHAINSAW_ERROR" && !force) {
      // if there was a previous chainsaw error, return
      // and do not process event
      return 'SKIP_EVENTS'
    }
    try {
      const state = await this.validator.generateConfirmPending(
        connext.convert.ChannelState('str', prev.state),
        { transactionHash: event.txHash }
      )
      if (prev.status == "CS_CHAINSAW_ERROR") {
        await this.channelsDao.removeChainsawErrorId(event.user)
      }

      const hash = this.utils.createChannelStateHash(state)

      const sigHub = await this.signerService.signMessage(hash);

      await this.channelsDao.applyUpdateByUser(event.user, 'ConfirmPending', this.config.hotWalletAddress, {
        ...state,
        sigHub
      } as ChannelState, { transactionHash: event.txHash } as ConfirmPendingArgs, chainsawId)

      return 'PROCESS_EVENTS'
    } catch (e) {
      const NUM_RETRY_ATTEMPTS = 10

      // add retry count
      let attempt = await this.redisGetRetryAttempt(event.user)
      this.log.error(`Error updating user ${event.user} channel, Error: ${e} attempt ${attempt} of ${NUM_RETRY_ATTEMPTS}`)
      // 10 retries until failing permenently
      // return 'RETRY' so caller knows to not record a poll and retry this event
      if (attempt < NUM_RETRY_ATTEMPTS) {
        await this.redisSetRetryAttempt(event.user, ++attempt)
        return 'RETRY'
      }

      this.log.error(`Exceeded max error attempts for user ${event.user}, putting channel into CS_CHAINSAW_ERROR status`)

      // switch channel status to cs chainsaw error and break out of
      // function

      // update the channel to insert chainsaw error event
      // id, which will trigger the status change check
      await this.channelsDao.addChainsawErrorId(event.user, event.chainsawId!)
      // insert poll event with error
      return 'SKIP_EVENTS'
    }
  }

  private async processDidStartExitChannel(chainsawId: number, event: DidStartExitChannelEvent) {
    const onchainChannel = await this.signerService.getChannelDetails(event.user)

    let disputeRecord = await this.channelDisputesDao.getActive(event.user)
    if (!disputeRecord) {
      // dispute might not have been initiated by us, so we need to add it here
      disputeRecord = await this.channelDisputesDao.create(event.user, 'Dispute caught by chainsaw', chainsawId, null, onchainChannel.channelClosingTime)
    } else {
      await this.channelDisputesDao.setExitEvent(disputeRecord.id, chainsawId, onchainChannel.channelClosingTime)
    }

    // check if sender was user
    if (event.senderIdx == 0) {
      this.log.info(`Hub inititated the challenge, so no need to respond; event ${prettySafeJson(event)}`)
      return
    }

    // TODO FIX AND REMOVE
    this.log.info(`event.senderIdx: ${JSON.stringify(event.senderIdx)}`)
    try {
      if ((event.senderIdx as any)._hex == "0x00") {
        this.log.info(`Hub inititated the challenge, so no need to respond; event ${prettySafeJson(event)}`)
        return
      }
    } catch (error) {
      this.log.error('Caught error trying to compare BN to 0.')
      this.log.error(error)
    }

    let data
    const latestUpdate = await this.channelsDao.getLatestExitableState(event.user)
    if (event.txCountGlobal <= latestUpdate.state.txCountGlobal) {
      this.log.info(`Channel has not exited with the latest state, hub will respond with the latest state: ${prettySafeJson(latestUpdate.state)}! event: ${prettySafeJson(event)}`)
      data = this.contract.methods.emptyChannelWithChallenge(
        [latestUpdate.state.user, latestUpdate.state.recipient],
        [
          latestUpdate.state.balanceWeiHub.toString(),
          latestUpdate.state.balanceWeiUser.toString()
        ],
        [
          latestUpdate.state.balanceTokenHub.toString(),
          latestUpdate.state.balanceTokenUser.toString()
        ],
        [
          latestUpdate.state.pendingDepositWeiHub.toString(),
          latestUpdate.state.pendingWithdrawalWeiHub.toString(),
          latestUpdate.state.pendingDepositWeiUser.toString(),
          latestUpdate.state.pendingWithdrawalWeiUser.toString()
        ],
        [
          latestUpdate.state.pendingDepositTokenHub.toString(),
          latestUpdate.state.pendingWithdrawalTokenHub.toString(),
          latestUpdate.state.pendingDepositTokenUser.toString(),
          latestUpdate.state.pendingWithdrawalTokenUser.toString()
        ],
        [latestUpdate.state.txCountGlobal, latestUpdate.state.txCountChain],
        latestUpdate.state.threadRoot,
        latestUpdate.state.threadCount,
        latestUpdate.state.timeout,
        latestUpdate.state.sigHub,
        latestUpdate.state.sigUser,
      ).encodeABI()
    } else {
      this.log.info(`Channel has exited with the latest state, hub will empty with onchain state! event: ${prettySafeJson(event)}`)
      data = this.contract.methods.emptyChannel(event.user).encodeABI()
    }
    const txn = await this.onchainTransactionService.sendTransaction(this.db, {
      from: this.config.hotWalletAddress,
      to: this.config.channelManagerAddress,
      data,
      meta: {
        completeCallback: 'CloseChannelService.startEmptyChannelCompleteCallback',
        args: {
          user: event.user
        }
      }
    })

    await this.channelDisputesDao.addStartExitOnchainTx(disputeRecord.id, txn)
  }

  private async processDidEmptyChannel(chainsawId: number, event: DidEmptyChannelEvent) {
    const disputeRecord = await this.channelDisputesDao.getActive(event.user)
    // we should always have the dispute in our DB
    if (!disputeRecord) {
      throw new Error(`Did not find record of dispute start. Event: ${event}`)
    }

    await this.channelDisputesDao.setEmptyEvent(disputeRecord.id, chainsawId)

    // zero out channel with new state
    const channel = await this.channelsDao.getChannelOrInitialState(event.user)
    const args: EmptyChannelArgs = { transactionHash: event.txHash }
    const newState = await this.validator.generateEmptyChannel(connext.convert.ChannelState('str', channel.state), args)
    const signed = await this.signerService.signChannelState(newState)
    await this.channelsDao.applyUpdateByUser(event.user, 'EmptyChannel', event.user, signed, args, chainsawId)
  }

  private async redisSetRetryAttempt(user: string, attempt: number) {
    this.log.info(`Saving chainsaw retry info for user: ${user}, attempt: ${attempt}`)
    await this.redis.set(`ChainsawRetry:${user}`, `${attempt}`)
  }

  private async redisGetRetryAttempt(user: string): Promise<number> {
    let attempt = await this.redis.get(`ChainsawRetry:${user}`)
    let attemptNum: number
    attemptNum = parseInt(attempt)
    if (isNaN(attemptNum)) {
      attemptNum = 0
    }
    return attemptNum
  }
}
