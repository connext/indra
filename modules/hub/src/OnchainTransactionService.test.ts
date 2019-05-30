import { OnchainTransactionsDao } from './dao/OnchainTransactionsDao'
import { default as DBEngine } from './DBEngine'
import { OnchainTransactionService } from './OnchainTransactionService'
import { assert, getTestConfig, getTestRegistry } from './testing'
import { MockGasEstimateDao } from './testing/mocks'
import { mkAddress } from './testing/stateUtils'
import { Logger, maybe } from './util'
const Web3 = require('web3')

const logLevel = 0
const log = new Logger('OnchainTransactionServiceTest', logLevel)
const config = getTestConfig({ logLevel })

describe('OnchainTransactionService', function() {
  const registry = getTestRegistry({
    Config: config,
    GasEstimateDao: new MockGasEstimateDao(),
    Web3: new Web3(new Web3.providers.HttpProvider(config.ethRpcUrl)),
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
            setTimeout(cb(errorResponse), 1)
          }
        },
      }
    },
    sendSignedTransaction: () => {
      return {
        on: (input, cb) => {
          if (input == 'error') {
            setTimeout(cb(errorResponse), 1)
          }
        },
      }
    },
    signTransaction: () => Promise.resolve({ 
      raw: '0xf86c808504a817c800825208943535353535353535353535353535353535353535880de0b6b3a76400008025a04f4c17305743700648bc4f6cd3038ec6f6af0df73e31757007b7f59df7bee88da07e1941b264348e80c78c4027afc65a87b0a5e43e86742b8ca0823584c6788fd0',
      tx: {
          nonce: '0x0',
          gasPrice: '0x4a817c800',
          gas: '0x5208',
          to: '0x3535353535353535353535353535353535353535',
          value: '0xde0b6b3a7640000',
          input: '0x',
          v: '0x25',
          r: '0x4f4c17305743700648bc4f6cd3038ec6f6af0df73e31757007b7f59df7bee88d',
          s: '0x7e1941b264348e80c78c4027afc65a87b0a5e43e86742b8ca0823584c6788fd0',
          hash: '0xda3be87732110de6c1354c83770aae630ede9ac308d9f7b399ecfba23d923384'
      } 
    })
  }
  const txService: OnchainTransactionService = registry.get('OnchainTransactionService')
  const db: DBEngine = registry.get('DBEngine')
  const dao: OnchainTransactionsDao = registry.get('OnchainTransactionsDao')

  beforeEach(async () => {
    await registry.reset()
    await registry.clearDatabase()
  })

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
      state: 'pending_failure',
    })
  })

  describe('More OnchainTransactionService', function() {
    this.timeout(5000)

    let txFromCallback = null
    beforeEach(() => txFromCallback = null)

    const web3 = new Web3(new Web3.providers.HttpProvider(config.ethRpcUrl))
    const registry = getTestRegistry({
      Config: config,
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
        log.warn(err)
        log.warn('WARNING: Parity is not running; OnchainTransactionService tests will be skipped.')
        log.warn('WARNING: These tests require Parity and not ganache, because ganache does not support eth_signTransaction:')
        log.warn('WARNING:   https://github.com/trufflesuite/ganache/issues/975')
        log.warn('WARNING: To run parity, use: ./hub/development/parity-run')
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
})
