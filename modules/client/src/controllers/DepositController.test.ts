import { MockConnextInternal, patch } from '../testing/mocks';
import { assert, } from '../testing/index';
// @ts-ignore
global.fetch = require('node-fetch-polyfill');

describe('DepositController: unit tests', () => {
  let connext: MockConnextInternal

  beforeEach(async () => {
    connext = new MockConnextInternal()
    await connext.start()
  })

  it('should work', async () => {
    await connext.depositController.requestUserDeposit({ amountWei: '420', amountToken: '69' })
    await new Promise(res => setTimeout(res, 10))

    connext.mockHub.assertReceivedUpdate({
      reason: 'ProposePendingDeposit',
      args: {
        depositWeiUser: '420',
        depositTokenUser: '69',
      },
      sigUser: true,
      sigHub: true,
    })

    connext.mockContract.assertCalled('userAuthorizedUpdate', {
      pendingDepositWeiUser: '420',
      pendingDepositTokenUser: '69',
    })

    assert.containSubset(connext.store.getState(), {
      persistent: {
        channel: {
          pendingDepositTokenHub: '9',
          pendingDepositTokenUser: '69',
          pendingDepositWeiHub: '8',
          pendingDepositWeiUser: '420',
        },
      },
    })
  })

  it('should fail if the hub returns an invalid timestamp', async () => {
    patch(connext.mockHub, 'requestDeposit', async (old: any, ...args: any[]) => {
      const res = await old(...args)
      res[0].update.args.timeout = 69
      return res
    })

    await assert.isRejected(
      connext.depositController.requestUserDeposit({
        amountWei: '420',
        amountToken: '69',
      }),
      /timestamp/
    )
  })

  it('should fail if the hub changes the proposed deposit', async () => {
    patch(connext.mockHub, 'requestDeposit', async (old: any, ...args: any[]) => {
      const res = await old(...args)
      res[0].update.args.depositWeiUser = '419'
      res[0].update.args.depositTokenUser = '68'
      return res
    })

    await assert.isRejected(
      connext.depositController.requestUserDeposit({
        amountWei: '420',
        amountToken: '69',
      }),
      /Deposit request does not match requested deposit/
    )
  })
})
