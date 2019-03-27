import { mkAddress } from "./testing/stateUtils";
import { MockGasEstimateDao } from "./testing/mocks";
import { getTestRegistry, assert } from "./testing";
import { maybe } from "./util";
import { OnchainTransactionService } from "./OnchainTransactionService";
import { default as DBEngine } from "./DBEngine";
import { OnchainTransactionsDao } from './dao/OnchainTransactionsDao'
const Web3 = require('web3')

describe('OnchainTransactionService', function() {
  const registry = getTestRegistry({
    Web3: new Web3(),
    GasEstimateDao: new MockGasEstimateDao(),
  })
  const web3 = registry.get('Web3')
  let errorResponse = 'unknown error'
  web3.eth = {
    ...web3.eth,
    getTransactionCount: () => Promise.resolve(1),
    estimateGas: () => Promise.resolve(42),
    sendTransaction: () => {
      return {
        on: (input, cb) => {
          if (input == 'error') {
            console.log("HERE:")
            setTimeout(cb(errorResponse), 1)
          }
        },
      }
    },
    sendSignedTransaction: () => {
      return {
        on: (input, cb) => {
          if (input == 'error') {
            console.log("HERE:")
            setTimeout(cb(errorResponse), 1)
          }
        },
      }
    },
    signTransaction: () => Promise.resolve({ raw: "0xbeef" })
  }
  const txService: OnchainTransactionService = registry.get('OnchainTransactionService')
  const db: DBEngine = registry.get('DBEngine')
  const dao: OnchainTransactionsDao = registry.get('OnchainTransactionsDao')

  it('should abort if error message is unknown', async function() {
    let txn = await db.withTransaction(async cxn => {
      return await txService.sendTransaction(cxn, {
        from: mkAddress('0x1'),
        to: mkAddress('0x1'),
        value: '69',
      })
    })

    // The transaction shouldn't change state if the error is unknown
    await txService.poll()
    assert.containSubset(await dao.getTransactionByLogicalId(db, txn.logicalId), {
      state: 'new',
    })

    // And returning a known error should correctly transition the tx into
    // a 'failed' state
    errorResponse = 'nonce too low'
    await txService.poll()
    assert.containSubset(await dao.getTransactionByLogicalId(db, txn.logicalId), {
      state: 'failed',
    })
  })
})

describe('OnchainTransactionService', function() {
  this.timeout(5000)

  let txFromCallback = null
  beforeEach(() => txFromCallback = null)

  const web3 = new Web3(new Web3.providers.HttpProvider('http://127.0.0.1:12123'))
  const registry = getTestRegistry({
    GasEstimateDao: new MockGasEstimateDao(),
    Web3: web3,
    ExampleCallback: {
      callbackMethod: tx => txFromCallback = tx
    },
  })

  let account

  beforeEach(async () => {
    await registry.reset()
    await registry.clearDatabase()
  })

  before(async function() {
    const web3 = registry.get('Web3')
    const [accounts, err] = await maybe(web3.eth.getAccounts())
    if (err) {
      console.log('err:', err)
      console.warn('WARNING: Parity is not running; OnchainTransactionService tests will be skipped.')
      console.warn('WARNING: These tests require Parity and not ganache, because ganache does not support eth_signTransaction:')
      console.warn('WARNING:   https://github.com/trufflesuite/ganache/issues/975')
      console.warn('WARNING: To run parity, use: ./hub/development/parity-run')
      this.skip()
      return
    }

    account = accounts[0]
    if (!account)
      throw new Error('Ganache is running but `web3.eth.getAccounts()` returned an empty list.')
  })

  let db: DBEngine
  let txService: OnchainTransactionService

  beforeEach(() => {
    db = registry.get('DBEngine')
    txService = registry.get('OnchainTransactionService')
    txService.runPoller(100)
    after(() => txService.stop())
  })

  it('should send transactions', async function() {
    const txn = await db.withTransaction(async cxn => {
      return await txService.sendTransaction(cxn, {
        from: account,
        to: account,
        value: '69',
        meta: {
          completeCallback: 'ExampleCallback.callbackMethod',
        },
      })
    })

    // Force Parity to mine a block
    await web3.eth.sendTransaction({from: account, to: account, value: 1})

    const res = await txService.awaitTransaction(txn.logicalId)
    assert.containSubset(res, {
      state: 'confirmed',
      value: '69',
    })
    assert.isOk(res.confirmedOn)

    // The callback should have been called with this transaction
    assert.containSubset(res, txFromCallback)

    const tx = await web3.eth.getTransaction(res.hash)
    assert.containSubset(res, {
      blockNum: tx.blockNumber,
      blockHash: tx.blockHash,
      transactionIndex: tx.transactionIndex,
      from: tx.from,
      to: tx.to,
    })
  })

  it('should handle failed transactions', async function() {
    const txn = await db.withTransaction(async cxn => {
      return await txService.sendTransaction(cxn, {
        from: account,
        to: account,
        value: '11579208923731619542357098500868790785326998466564056403945758400791312963993',
        meta: {
          completeCallback: 'ExampleCallback.callbackMethod',
        },
      })
    })

    // Force Parity to mine a block
    await web3.eth.sendTransaction({from: account, to: account, value: 1})

    const res = await txService.awaitTransaction(txn.logicalId)
    assert.containSubset(res, {
      state: 'failed',
    })
    assert.isOk(res.failedOn)

    // The callback should have been called with this transaction
    assert.containSubset(res, txFromCallback)

    //const tx = await web3.eth.getTransaction(res.hash) // TODO: REB-61
    //assert.equal(tx, null)
    assert.equal(res.hash, null)
  })

  /*
   * NOTE: When run manually, this test does pass. However, it's not super
   * straightforward to setup right now, as it depends on a contract being
   * deployed, and we don't have good infra to test against that.
   *
   * This will be an easy fix once the Dockerized contract testing stuff is in
   * place.
  it('should handle reverted transactions', async function() {
    const txn = await db.withTransaction(async cxn => {
      return await txService.sendTransaction(cxn, {
        from: account,
        to: '0x3DD0864668C36D27B53a98137764c99F9FD5B7B2',
        data: contract.methods.emptyChannel(mkAddress('0x0')).encodeABI(),
        gas: 69000,
        meta: {
          completeCallback: 'ExampleCallback.callbackMethod',
        },
      })
    })

    // Force Parity to mine a block
    await web3.eth.sendTransaction({from: account, to: account, value: 1})

    const res = await txService.awaitTransaction(txn.logicalId)
    assert.containSubset(res, {
      state: 'failed',
      failedReason: 'EVM revert',
    })
    assert.isOk(res.failedOn)

    // The callback should have been called with this transaction
    assert.containSubset(res, txFromCallback)
  })
  */
})
