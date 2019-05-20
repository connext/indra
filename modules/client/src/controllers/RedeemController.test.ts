import { ethers as eth } from 'ethers'

import { assert } from '../testing'
import { MockConnextInternal } from '../testing/mocks'

describe('Redeem Controller: unit tests', () => {
  let connext: MockConnextInternal

  beforeEach(async () => {
    connext = new MockConnextInternal()
    await connext.start()
  })

  it('should work even if redeemer has no channel', async () => {
    const secret = connext.generateSecret()
    assert.isTrue(eth.utils.isHexString(secret))
    const res = await connext.redeemController.redeem(secret)
    assert.ok(res.purchaseId)

    await new Promise((resolve: any): any => setTimeout(resolve, 10))

    connext.mockHub.assertReceivedUpdate({
      args: {
        depositTokenUser: '1',
        depositWeiUser: '0',
      },
      reason: 'ProposePendingDeposit',
      sigHub: true,
      sigUser: true,
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
      /The secret provided is not a hex string./,
    )
  })

  afterEach(async () => {
    await connext.stop()
  })
})
