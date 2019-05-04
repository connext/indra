import { mkAddress, parameterizedTests } from '../testing';
import { MockConnextInternal, MockStore } from '../testing/mocks';
import { WithdrawalParameters, convertChannelState } from '../types';
import { Big } from '../lib/bn';
// @ts-ignore
global.fetch = require('node-fetch-polyfill');

describe('WithdrawalController: unit tests', () => {
  const user = mkAddress('0xAAA')
  let connext: MockConnextInternal
  const mockStore = new MockStore()
  const exchangeRate = '5'

  beforeEach(async () => {
     // add channel with initial booty balance to exchange and withdraw
     mockStore.setChannel({
      user,
      balanceWei: [10, 5],
      balanceToken: [0, 50],
    })
    mockStore.setExchangeRate({ 'USD': exchangeRate })
    connext = new MockConnextInternal({ 
      user, 
      store: mockStore.createStore() 
    })
  })

  parameterizedTests([
    {
      name: "should withdraw all of users tokens",
      args: {
        exchangeRate: '5',
        recipient: mkAddress('0xBBB'),
        tokensToSell: '50',
        withdrawalWeiUser: '5',
        weiToSell: null,
        withdrawalTokenUser: null,
      },
    }
  ], ({ name, args, }) => {

    it(name, async () => {
      await connext.start()

      const preWdChan = convertChannelState("bn",
        connext.store.getState().persistent.channel
      )

      // wait to allow controller to set exchange rates
      await new Promise(res => setTimeout(res, 20))

      // ignore args, should be Partial<Withdrawal> | SuccinctWithdrawal
      // @ts-ignore
      await connext.withdrawalController.requestUserWithdrawal(args)

      await new Promise(res => setTimeout(res, 20))

      const targetWeiUser = preWdChan.balanceWeiUser
        .sub(Big(args.weiToSell || 0))
        .sub(Big(args.withdrawalWeiUser || 0))
        .toString()

      const targetTokenUser = preWdChan.balanceTokenUser
        .sub(Big(args.tokensToSell || 0))
        .sub(Big(args.withdrawalTokenUser || 0))
        .toString()

      connext.mockHub.assertReceivedUpdate({
        reason: 'ProposePendingWithdrawal',
        args: {
          exchangeRate: args.exchangeRate || exchangeRate,
          recipient: args.recipient || user,
          tokensToSell: args.tokensToSell || '0',
          weiToSell: args.weiToSell || '0',
          targetWeiUser,
          targetTokenUser,
        },
        sigUser: true,
        sigHub: false,
      })
    })
  })

  afterEach(async () => {
    await connext.stop()
  })
})
