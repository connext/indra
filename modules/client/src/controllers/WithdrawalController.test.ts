import { mkAddress, parameterizedTests, assert } from '../testing';
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
      name: "should withdraw all of users tokens as wei",
      args: {
        exchangeRate: '5',
        recipient: mkAddress('0xBBB'),
        tokensToSell: '50',
        withdrawalWeiUser: '5',
        weiToSell: null,
        withdrawalTokenUser: null,
      },
    }, 
    {
      name: "should fail if recipient is not a valid address",
      args: {
        recipient: 'fail'
      },
      failsWith: /Recipient is not a valid address./
    },
    {
      name: "should fail if user wds more wei than is in their channel",
      args: {
        withdrawalWeiUser: '100'
      },
      failsWith: /Cannot withdraw more wei than what is in your channel./
    },
    {
      name: "should fail if user tries to sell more tokens than they have",
      args: {
        tokensToSell: '100'
      },
      failsWith: /Cannot sell more tokens than exist in your channel./
    },
    {
      name: "should fail if user tries to withdraw tokens",
      args: {
        withdrawalTokenUser: '5'
      },
      failsWith: /User token withdrawals are not permitted at this time./
    },
    {
      name: "should fail if user tries to exchange wei",
      args: {
        weiToSell: '5'
      },
      failsWith: /User exchanging wei at withdrawal is not permitted at this time./
    },
  ], ({ name, args, failsWith }) => {

    it(name, async () => {
      await connext.start()

      const preWdChan = convertChannelState("bn",
        connext.store.getState().persistent.channel
      )

      // wait to allow controller to set exchange rates
      await new Promise(res => setTimeout(res, 20))

      if (failsWith) {
        // ignore args, should be Partial<Withdrawal> | SuccinctWithdrawal
        await assert.isRejected(
          // @ts-ignore
          connext.withdrawalController.requestUserWithdrawal(args),
          failsWith
        )
        return
      }
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
