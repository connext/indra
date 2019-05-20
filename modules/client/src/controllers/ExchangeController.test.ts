import { mkAddress } from '../testing'
import { MockConnextInternal, MockStore } from '../testing/mocks'

describe('ExchangeController: unit tests', () => {
  const user = mkAddress('0xAAA')
  let connext: MockConnextInternal
  const mockStore = new MockStore()

  beforeEach(async () => {
    connext = new MockConnextInternal()
    await connext.start()
  })

  it('should exchange all of users wei balance if total exchanged is under limit', async () => {
    // add channel to the store
    mockStore.setChannel({
      balanceToken: [50, 0],
      balanceWei: [0, 10],
      user,
    })
    mockStore.setExchangeRate({ 'DAI': '5' })
    connext = new MockConnextInternal({ user, store: mockStore.createStore() })
    await connext.start()
    await connext.exchangeController.exchange('10', 'wei')
    await new Promise((res: any): any => setTimeout(res, 20))

    connext.mockHub.assertReceivedUpdate({
      args: {
        seller: 'user',
        tokensToSell: '0',
        weiToSell: '10',
      },
      reason: 'Exchange',
      sigHub: false,
      sigUser: true,
    })
  })

  afterEach(async () => {
    await connext.stop()
  })
})
