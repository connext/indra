import { assert, } from '../testing/index';
import { MockConnextInternal, patch } from '../testing/mocks';
// @ts-ignore
global.fetch = require('node-fetch-polyfill');

describe('DepositController: unit tests', () => {
  let connext: MockConnextInternal

  beforeEach(async () => {
    connext = new MockConnextInternal()
    await connext.start()
  })

  // TODO: properly mock out token transfer approval
  it('should work for wei', async () => {
    await connext.depositController.requestUserDeposit({ amountWei: '420', amountToken: '0' })
    await new Promise(res => setTimeout(res, 10))

    connext.mockHub.assertReceivedUpdate({
      reason: 'ProposePendingDeposit',
      args: {
        depositWeiUser: '420',
        depositTokenUser: '0',
      },
      sigUser: true,
      sigHub: true,
    })

    connext.mockContract.assertCalled('userAuthorizedUpdate', {
      pendingDepositWeiUser: '420',
      pendingDepositTokenUser: '0',
    })

    assert.containSubset(connext.store.getState(), {
      persistent: {
        channel: {
          pendingDepositTokenHub: '9',
          pendingDepositTokenUser: '0',
          pendingDepositWeiHub: '8',
          pendingDepositWeiUser: '420',
        },
      },
    })
  })

  it('should fail if the hub returns invalidly signed update', async () => {
    connext.validator.generateProposePendingDeposit = (req, signer) => { throw new Error('Invalid signer') }

    await assert.isRejected(
      connext.depositController.requestUserDeposit({
        amountWei: '420',
        amountToken: '69',
      }),
      /Invalid signer/
    )

  })

  it('should fail if the hub returns an invalid timestamp', async () => {
    patch(connext.mockHub, 'requestDeposit', async (old: any, ...args: any[]) => {
      const res = await old(...args)
      res.updates[0].update.args.timeout = 69
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
})
