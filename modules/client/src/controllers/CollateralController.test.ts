import { MockConnextInternal } from '../testing/mocks'

describe('CollateralController: unit tests', () => {

  let connext: MockConnextInternal

  beforeEach(async () => {
    connext = new MockConnextInternal()
    await connext.start()
  })

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

  afterEach(async () => {
    await connext.stop()
  })

})
