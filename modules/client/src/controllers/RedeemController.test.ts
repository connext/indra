import { MockConnextInternal } from '../testing/mocks';
import { assert } from '../testing';
const w3utils = require('web3-utils')

// @ts-ignore
global.fetch = require('node-fetch-polyfill');

describe('Redeem Controller: unit tests', () => {
  let connext: MockConnextInternal

  beforeEach(async () => {
    connext = new MockConnextInternal()
    await connext.start()
  })

  it('should work even if redeemer has no channel', async () => {
    const secret = connext.generateSecret()
    assert.isTrue(w3utils.isHex(secret))
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
