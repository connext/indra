import { MockStore, MockConnextInternal } from '../testing/mocks';
import { mkAddress } from '../testing';
import { WithdrawalParameters } from '../types';
// @ts-ignore
global.fetch = require('node-fetch-polyfill');

describe('WithdrawalController: unit tests', () => {
  const user = mkAddress('0xUUU')
  let connext: MockConnextInternal
  const mockStore = new MockStore()

  beforeEach(async () => {
    connext = new MockConnextInternal()
  })

  it('should exchange all of users wei balance if total exchanged tokens under booty limit', async () => {
    // add channel with initial booty balance to exchange and withdraw
    mockStore.setChannel({
      user,
      balanceWei: [10, 0],
      balanceToken: [0, 50],
    })
    mockStore.setExchangeRate({ 'USD': '5' })
    // mockStore.setExchangeRate({ 'USD': '5' })
    connext = new MockConnextInternal({ user, store: mockStore.createStore() })

    await connext.start()

    const params: WithdrawalParameters = {
      exchangeRate: '5',
      recipient: mkAddress('0xRRR'),
      tokensToSell: '50',
      withdrawalWeiUser: '5',
      weiToSell: '0',
    }

    // wait to allow controller to set exchange rates
    await new Promise(res => setTimeout(res, 20))

    await connext.withdrawalController.requestUserWithdrawal(params)
    await new Promise(res => setTimeout(res, 20))

    connext.mockHub.assertReceivedUpdate({
      reason: 'ProposePendingWithdrawal',
      args: {
        exchangeRate: '5',
        tokensToSell: '50',
        ...params
      },
      sigUser: true,
      sigHub: false,
    })
  })

  afterEach(async () => {
    await connext.stop()
  })
})
