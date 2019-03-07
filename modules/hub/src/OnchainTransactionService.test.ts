import { mkAddress } from "./testing/stateUtils";
import { MockGasEstimateDao } from "./testing/mocks";
import { getTestRegistry, assert } from "./testing";
import { maybe } from "./util";
import { OnchainTransactionService } from "./OnchainTransactionService";
import { default as DBEngine } from "./DBEngine";
const Web3 = require('web3')

describe('OnchainTransactionService', function() {
  this.timeout(5000)

  let txFromCallback = null
  beforeEach(() => txFromCallback = null)

  const registry = getTestRegistry({
    GasEstimateDao: new MockGasEstimateDao(),
    Web3: new Web3(new Web3.providers.HttpProvider('http://127.0.0.1:12123')),
    ExampleCallback: {
      callbackMethod: tx => txFromCallback = tx
    },
  })

  let account

  beforeEach(async () => registry.reset())

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
  let web3: any
  let txService: OnchainTransactionService

  beforeEach(() => {
    db = registry.get('DBEngine')
    web3 = registry.get('Web3')
    txService = registry.get('OnchainTransactionService')
    txService.start(100)
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

    const tx = await web3.eth.getTransaction(res.hash)
    assert.equal(tx, null)
  })
})
