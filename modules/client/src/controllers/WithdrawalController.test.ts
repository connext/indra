import { Logger, toBN } from '../lib'
import { assert, mkAddress, MockConnextInternal, MockStore, parameterizedTests } from '../testing'
import { convertChannelState } from '../types'

const logLevel = 1 // 0 = no logs, 5 = all logs
const log = new Logger('WithdrawalControllerTests', logLevel)

const user = mkAddress('0xAAA')
let connext: MockConnextInternal
const mockStore = new MockStore()
const exchangeRate = '5'

describe('WithdrawalController', () => {
  describe('createWithdrawalParameters', () => {

    parameterizedTests([
      {
        args: { amountWei: '1' },
        expected: { withdrawalWeiUser: '1' },
        name: 'createWithdrawalParameters should work when supplied with only an amountWei',
      },

      {
        args: { amountToken: '1' },
        expected: { withdrawalTokenUser: '1' },
        name: 'should work when supplied with only an amountToken',
      },

      {
        args: { withdrawalWeiUser: '1' },
        expected: { withdrawalWeiUser: '1', withdrawalTokenUser: '0' },
        name: 'should insert default values for partial withdrawal parameters',
      },

      {
        args: { amountWei: '10' },
        expected: { withdrawalWeiUser: '5', tokensToSell: '25' },
        name: 'should correctly exchange on withdrawals when provided with an amount ' +
          '(native balance first)',
      },

      {
        args: { amountWei: '10', amountToken: '15' },
        expected: { withdrawalWeiUser: '5', tokensToSell: '25', withdrawalTokenUser: '15' },
        name: 'should correctly calculate parameters if both wd amounts are supplied',
      },

    ], async ({ args, expected }: any): Promise<any> => {
      mockStore.setChannel({
        balanceToken: [0, 50],
        balanceWei: [10, 5],
        user,
      })
      mockStore.setExchangeRate({ 'DAI': exchangeRate })
      connext = new MockConnextInternal({
        logLevel,
        store: mockStore.createStore(),
      })

      await connext.start()

      const ans = connext.withdrawalController.createWithdrawalParameters(args)
      log.info(`Withdrawal Parameters: ${ans}`)
      assert.containSubset(ans, {
        exchangeRate: '5',
        recipient: connext.wallet.address,
        tokensToSell: '0',
        weiToSell: '0',
        withdrawalTokenUser: '0',
        withdrawalWeiUser: '0',
        ...expected,
      })
      await connext.stop()

    })
  })

  describe('Unit tests', () => {
    beforeEach(async () => {
       // add channel with initial booty balance to exchange and withdraw
       mockStore.setChannel({
        balanceToken: [0, 50],
        balanceWei: [10, 5],
        user,
      })
      mockStore.setExchangeRate({ 'DAI': exchangeRate })
      connext = new MockConnextInternal({
        logLevel,
        store: mockStore.createStore(),
        user,
      })
    })

    afterEach(async () => connext.stop())

    parameterizedTests([
      {
        args: {
          recipient: mkAddress('0xBBB'),
          tokensToSell: '50',
          weiToSell: undefined,
          withdrawalTokenUser: undefined,
          withdrawalWeiUser: '5',
        },
        name: 'should withdraw all of users tokens as wei',
      },
      {
        args: { recipient: 'fail' },
        failsWith: /Recipient is not a valid address./,
        name: 'should fail if recipient is not a valid address',
      },
      {
        args: { withdrawalWeiUser: '100' },
        failsWith: /Cannot withdraw more wei than what is in your channel./,
        name: 'should fail if user wds more wei than is in their channel',
      },
      {
        args: { tokensToSell: '100' },
        failsWith: /Cannot sell more tokens than exist in your channel./,
        name: 'should fail if user tries to sell more tokens than they have',
      },
      {
        args: { withdrawalTokenUser: '5' },
        failsWith: /User token withdrawals are not permitted at this time./,
        name: 'should fail if user tries to withdraw tokens',
      },
      {
        args: { weiToSell: '5' },
        failsWith: /User exchanging wei at withdrawal is not permitted at this time./,
        name: 'should fail if user tries to exchange wei',
      },
    ], async ({ name, args, failsWith }: any): Promise<any> => {
      await connext.start()

      const preWdChan = convertChannelState('bn', connext.store.getState().persistent.channel)

      // wait to allow controller to set exchange rates
      await new Promise((res: any): any => setTimeout(res, 20))

      if (failsWith) {
        // args should be Partial<Withdrawal> | SuccinctWithdrawal
        await assert.isRejected(
          connext.withdrawalController.requestUserWithdrawal(args as any),
          failsWith,
        )
        return
      }
      // args should be Partial<Withdrawal> | SuccinctWithdrawal
      await connext.withdrawalController.requestUserWithdrawal(args as any)

      await new Promise((res: any): any => setTimeout(res, 20))

      const targetWeiUser = preWdChan.balanceWeiUser
        .sub(toBN(args.weiToSell || 0))
        .sub(toBN(args.withdrawalWeiUser || 0))
        .toString()

      const targetTokenUser = preWdChan.balanceTokenUser
        .sub(toBN(args.tokensToSell || 0))
        .sub(toBN(args.withdrawalTokenUser || 0))
        .toString()

      connext.mockHub.assertReceivedUpdate({
        args: {
          exchangeRate,
          recipient: args.recipient || user,
          targetTokenUser,
          targetWeiUser,
          tokensToSell: args.tokensToSell || '0',
          weiToSell: args.weiToSell || '0',
        },
        reason: 'ProposePendingWithdrawal',
        sigHub: false,
        sigUser: true,
      })
    })

  })
})
