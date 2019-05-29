import { MockConnextInternal } from '../testing'

const logLevel = 1 // 0 = no logs, 5 = all logs

describe('CollateralController', () => {
  let connext: MockConnextInternal

  beforeEach(async () => {
    connext = new MockConnextInternal({ logLevel })
    await connext.start()
  })

  afterEach(async () => connext.stop())

  it('should work', async () => {
    await connext.collateralController.requestCollateral()
    await new Promise((res: any): any => setTimeout(res, 10))
    connext.mockHub.assertReceivedUpdate({
      args: {
        depositTokenHub: '69',
        depositTokenUser: '0',
        depositWeiHub: '420',
        depositWeiUser: '0',
      },
      reason: 'ProposePendingDeposit',
      sigHub: false,
      sigUser: true,
    })
  })

})
