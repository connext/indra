import { assert, MockConnextInternal, patch } from '../testing'

const logLevel = 1 // 0 = no logs, 5 = all logs

describe('DepositController', () => {
  let connext: MockConnextInternal

  beforeEach(async () => {
    connext = new MockConnextInternal({ logLevel })
    await connext.start()
  })

  afterEach(async () => connext.stop())

  // TODO: properly mock out token transfer approval
  it('should work for wei', async () => {
    await connext.depositController.requestUserDeposit({ amountWei: '420', amountToken: '0' })
    await new Promise((res: any): any => setTimeout(res, 10))

    connext.mockHub.assertReceivedUpdate({
      args: {
        depositTokenUser: '0',
        depositWeiUser: '420',
      },
      reason: 'ProposePendingDeposit',
      sigHub: true,
      sigUser: true,
    })

    connext.mockContract.assertCalled('userAuthorizedUpdate', {
      pendingDepositTokenUser: '0',
      pendingDepositWeiUser: '420',
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
    connext.validator.generateProposePendingDeposit = (req: any, signer: any): any => {
      throw new Error('Invalid signer')
    }

    await assert.isRejected(
      connext.depositController.requestUserDeposit({
        amountToken: '69',
        amountWei: '420',
      }),
      /Invalid signer/,
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
        amountToken: '69',
        amountWei: '420',
      }),
      /timestamp/,
    )
  })
})
