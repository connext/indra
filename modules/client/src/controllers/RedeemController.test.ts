import { MockStore, MockConnextInternal } from '../testing/mocks';
import { mkAddress, assert, mkHash, getDepositArgs } from '../testing';
import Web3 = require('web3')

// @ts-ignore
global.fetch = require('node-fetch-polyfill');

describe('Redeem Controller: unit tests', () => {
  const user = mkAddress('0xUUU')
  let connext: MockConnextInternal
  const mockStore = new MockStore()

  beforeEach(async () => {
    connext = new MockConnextInternal()
    await connext.start()
  })

  it('should work even if redeemer has no channel', async () => {
    const secret = connext.generateSecret()
    assert.isTrue(Web3.utils.isHex(secret))
    const res = await connext.redeemController.redeem(secret)
    assert.ok(res.purchaseId)

    await new Promise(res => setTimeout(res, 10))

    connext.mockHub.assertReceivedUpdate({
      reason: 'ProposePendingDeposit',
      args: {
        depositWeiUser: '0',
        depositTokenUser: '1',
      },
      sigUser: true,
      sigHub: true,
    })

    assert.containSubset(connext.store.getState(), {
      persistent: {
        channel: {
          pendingDepositTokenHub: '0',
          pendingDepositTokenUser: '1',
          pendingDepositWeiHub: '0',
          pendingDepositWeiUser: '0',
        },
      },
    })

  })

  it('should fail if invalid secret is provided', async () => {
    await assert.isRejected(
      connext.redeemController.redeem('fail'),
      /The secret provided is not a hex string./
    )
  })

  afterEach(async () => {
    await connext.stop()
  })
})
