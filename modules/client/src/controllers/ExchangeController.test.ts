import { MockStore, MockConnextInternal } from '../testing/mocks';
import { mkAddress } from '../testing';
// @ts-ignore
global.fetch = require('node-fetch-polyfill');

describe('ExchangeController: unit tests', () => {
  const user = mkAddress('0xUUU')
  let connext: MockConnextInternal
  const mockStore = new MockStore()

  beforeEach(async () => {
    connext = new MockConnextInternal()
    await connext.start()
  })

  it('should exchange all of users wei balance if total exchanged tokens under booty limit', async () => {
    // add channel to the store
    mockStore.setChannel({
      user,
      balanceWei: [0, 10],
      balanceToken: [50, 0],
    })
    mockStore.setExchangeRate({ 'USD': '5' })
    connext = new MockConnextInternal({ user, store: mockStore.createStore() })
    await connext.start()
    await connext.exchangeController.exchange('10', 'wei')
    await new Promise(res => setTimeout(res, 20))

    connext.mockHub.assertReceivedUpdate({
      reason: 'Exchange',
      args: {
        weiToSell: '10',
        tokensToSell: '0',
        seller: "user",
      },
      sigUser: true,
      sigHub: false,
    })
  })

  afterEach(async () => {
    await connext.stop()
  })
})
