import { toBN } from './lib'
import { calculateExchange, StateGenerator } from './StateGenerator'
import * as t from './testing'
import {
  addSigToChannelState,
  ChannelState,
  ChannelStateBN,
  convertChannelState,
  convertDeposit,
  convertExchange,
  convertPayment,
  convertThreadPayment,
  convertThreadState,
  convertWithdrawal,
  InvalidationArgs,
  ThreadStateBN,
  WithdrawalArgs,
} from './types'
import { Utils } from './Utils'

const assert = t.assert
const sg = new StateGenerator()
const utils = new Utils()

const createHigherNoncedChannelState = (
  prev: ChannelStateBN,
  ...overrides: t.PartialSignedOrSuccinctChannel[]
): any => {
  const state = t.getChannelState('empty', {
    recipient: prev.user,
    ...overrides[0],
    txCountGlobal: prev.txCountGlobal + 1,
  })
  return convertChannelState('str-unsigned', state)
}

const createHigherNoncedThreadState = (
  prev: ThreadStateBN,
  ...overrides: t.PartialSignedOrSuccinctThread[]
): any => {
  const state = t.getThreadState('empty', {
    ...prev, // for address vars
    ...overrides[0],
    sigA: t.mkHash('buttstuff'),
    txCount: prev.txCount + 1,
  })
  return convertThreadState('bn', state)
}

const createPreviousChannelState = (...overrides: t.PartialSignedOrSuccinctChannel[]): any => {
  const state = t.getChannelState('empty', {
    recipient: t.mkAddress('0xAAA'),
    sigHub: t.mkHash('errywhere'),
    sigUser: t.mkHash('booty'),
    user: t.mkAddress('0xAAA'),
    ...overrides[0],
  })
  return convertChannelState('bn', state)
}

const createPreviousThreadState = (...overrides: t.PartialSignedOrSuccinctThread[]): any => {
  const state = t.getThreadState('empty', {
    sigA: t.mkHash('peachy'),
    ...overrides[0],
  })
  return convertThreadState('bn', state)
}

describe('StateGenerator', () => {
  describe('channel payment', () => {
    it('should generate a channel payment', async () => {
      const prev = createPreviousChannelState({
        balanceToken: ['2', '0'],
        balanceWei: ['3', '0'],
      })
      const payment = {
        amountToken: '2',
        amountWei: '3',
      }
      const curr = sg.channelPayment(prev, convertPayment('bn', { ...payment, recipient: 'user' }))
      assert.deepEqual(curr, createHigherNoncedChannelState(prev, {
        balanceToken: [0, 2],
        balanceWei: [0, 3],
      }))
    })
  })

  describe('exchange', () => {
    it('should create a wei for tokens exchange update', async () => {
      const prev = createPreviousChannelState({
        balanceToken: [12, 5],
        balanceWei: [5, 3],
      })
      const args = convertExchange('bn', {
        exchangeRate: '4',
        seller: 'user',
        tokensToSell: 0,
        weiToSell: 3,
      })
      const curr = sg.exchange(prev, args)
      assert.deepEqual(curr, createHigherNoncedChannelState(prev, {
        balanceToken: [0, 17],
        balanceWei: [8, 0],
      }))
    })

    it('should create a tokens for wei exchange update', async () => {
      const prev = createPreviousChannelState({
        balanceToken: [17, 50],
        balanceWei: [25, 3],
      })
      const args = convertExchange('bn', {
        exchangeRate: '5',
        seller: 'user',
        tokensToSell: '25',
        weiToSell: '0',
      })
      const curr = sg.exchange(prev, args)
      assert.deepEqual(curr, createHigherNoncedChannelState(prev, {
        balanceToken: [42, 25],
        balanceWei: [20, 8],
      }))
    })
  })

  describe('deposit', () => {
    it('should create a propose pending deposit update', async () => {
      const prev = createPreviousChannelState()
      const args = convertDeposit('bn', {
        depositTokenHub: '1',
        depositTokenUser: '9',
        depositWeiHub: '5',
        depositWeiUser: '3',
        timeout: 600,
      })
      const curr = sg.proposePendingDeposit(prev, args)
      assert.deepEqual(curr, createHigherNoncedChannelState(prev, {
        pendingDepositToken: [1, 9],
        pendingDepositWei: [5, 3],
        timeout: 600,
        txCountChain: prev.txCountChain + 1,
      }))
    })
  })

  describe('Withdrawal states', () => {
    const exchangeRate = 5

    for (const tc of [
      {
        args: {
          targetTokenHub: 20,
          targetTokenUser: 2,
          targetWeiUser: 4,
          tokensToSell: 5,
        },
        expected: {
          balanceTokenHub: 5,
          balanceTokenUser: 2,
          balanceWeiUser: 4,
          pendingDepositTokenHub: 15,
          pendingDepositWeiUser: 1,
          pendingWithdrawalWeiUser: 3,
        },
        name: 'Sell tokens, withdraw wei, hub deposit tokens',
        prev: {
          balanceTokenUser: 7,
          balanceWeiUser: 6,
        },
      },

      {
        args: {
          targetTokenUser: 5,
          targetWeiUser: 11,
          tokensToSell: 1,
        },
        expected: {
          pendingDepositTokenUser: 2,
          pendingDepositWeiUser: 11,
        },
        name: 'Sell tokens, increase tokens balance, add some wei to balance',
        prev: {
          balanceTokenUser: 3,
        },
      },

      {
        args: {
          targetTokenHub: 24,
          targetWeiHub: 20,
        },
        expected: {
          balanceTokenHub: 11,
          balanceWeiHub: 8,
          pendingDepositTokenHub: 13,
          pendingDepositWeiHub: 12,
        },
        name: 'Hub deposit and withdrawal simplification',
        prev: {
          balanceTokenHub: 11,
          balanceWeiHub: 8,
        },
      },

      {
        args: {
          targetTokenUser: 2,
          tokensToSell: 5,
        },
        expected: {
          balanceTokenUser: 2,
          pendingDepositWeiUser: 1,
          pendingWithdrawalTokenHub: 5,
          pendingWithdrawalWeiUser: 1,
        },
        name: 'Simple sell tokens',
        prev: {
          balanceTokenUser: 7,
        },
      },

      {
        args: {
          targetTokenHub: 20,
          targetTokenUser: 2,
          targetWeiUser: 4,
          tokensToSell: 5,
        },
        expected: {
          balanceTokenHub: 5,
          balanceTokenUser: 2,
          balanceWeiUser: 4,
          pendingDepositTokenHub: 15,
          pendingDepositWeiUser: 1,
          pendingWithdrawalWeiUser: 3,
        },
        name: 'Sell tokens, withdraw wei, hub deposit tokens',
        prev: {
          balanceTokenUser: 7,
          balanceWeiUser: 6,
        },
      },

      {
        args: {
          targetTokenUser: 5,
          targetWeiUser: 11,
          tokensToSell: 1,
        },
        expected: {
          pendingDepositTokenUser: 2,
          pendingDepositWeiUser: 11,
        },
        name: 'Sell tokens, increase tokens balance, add some wei to balance',
        prev: {
          balanceTokenUser: 3,
        },
      },

      {
        args: {
          targetTokenHub: 24,
          targetWeiHub: 20,
        },
        expected: {
          balanceTokenHub: 11,
          balanceWeiHub: 8,
          pendingDepositTokenHub: 13,
          pendingDepositWeiHub: 12,
        },
        name: 'Hub deposit and withdrawal simplification',
        prev: {
          balanceTokenHub: 11,
          balanceWeiHub: 8,
        },
      },

      {
        args: {
          additionalTokenHubToUser: 3,
          additionalWeiHubToUser: 4,
          targetTokenHub: 12,
          targetWeiHub: 13,
          tokensToSell: 5,
        },
        expected: {
          balanceTokenHub: 12,
          balanceTokenUser: 0,
          balanceWeiHub: 10,
          balanceWeiUser: 0,
          pendingDepositTokenUser: 3,
          pendingDepositWeiHub: 3,
          pendingDepositWeiUser: 4,
          pendingWithdrawalTokenHub: 4,
          pendingWithdrawalTokenUser: 3,
          pendingWithdrawalWeiUser: 5,
        },
        name: 'Hub send additional wei + tokens',
        prev: {
          balanceTokenHub: 11,
          balanceTokenUser: 5,
          balanceWeiHub: 11,
        },
      },

      {
        args: {
          targetTokenHub: 6,
          targetWeiHub: 0,
          targetWeiUser: 5,
          tokensToSell: 5,
        },
        expected: {
          balanceTokenHub: 6,
          balanceTokenUser: 0,
          balanceWeiHub: 0,
          balanceWeiUser: 5,
          pendingWithdrawalTokenHub: 2,
          pendingWithdrawalWeiHub: 9,
          pendingWithdrawalWeiUser: 3,
        },
        name: 'User withdrawal and hub recollatoralize',
        prev: {
          balanceTokenHub: 3,
          balanceTokenUser: 5,
          balanceWeiHub: 10,
          balanceWeiUser: 7,
        },
      },

      {
        args: {
          targetTokenHub: 20,
          targetTokenUser: 2,
          targetWeiUser: 1,
          tokensToSell: 15,
        },
        expected: {
          balanceTokenHub: 15,
          balanceTokenUser: 2,
          balanceWeiUser: 0,
          pendingDepositTokenHub: 5,
          pendingDepositWeiUser: 3,
          pendingWithdrawalWeiUser: 2,
        },
        name: 'Token sale and hub adds additional tokens',
        prev: {
          balanceTokenUser: 17,
        },
      },

      {
        args: {
          targetTokenHub: 20,
          targetTokenUser: 2,
          targetWeiUser: 1,
          tokensToSell: 15,
        },
        expected: {
          balanceTokenHub: 15,
          balanceTokenUser: 2,
          balanceWeiUser: 0,
          pendingDepositTokenHub: 5,
          pendingDepositWeiUser: 3,
          pendingWithdrawalWeiUser: 2,
        },
        name: 'Token sale and hub adds additional tokens',
        prev: {
          balanceTokenUser: 17,
        },
      },
    ]) {

      const args2Str = (args: any): string =>
        Object.entries(args).map((x: any) => `${x[0]}: ${x[1]}`).join(', ')

      it(`${tc.name}: ${args2Str(tc.args)}`, () => {
        const prev = convertChannelState('bn', t.getChannelState('empty', tc.prev))
        const args = convertWithdrawal('bn', t.getWithdrawalArgs('empty', tc.args, {
          exchangeRate: exchangeRate.toString(),
        }))
        const s = convertChannelState('str-unsigned', sg.proposePendingWithdrawal(prev, args))

        const expected = {
          ...prev,
          ...tc.expected,
          timeout: 6969,
          txCountChain: 2,
          txCountGlobal: 2,
        }
        assert.deepEqual(s, convertChannelState('str-unsigned', expected))
      })

    }
  })

  describe('invalidation', () => {
    // balances are in [hub, user] form as in testing helpers

    // withdrawal invalidations should cover wei wds and token wds where:
    // 1. Full withdrawals
    //    - no exchange
    //    - uncollateralized exchange
    //    - fully collateralized exchange
    //    - partially collateralized exchange
    // 2. Partial Withdrawals
    //    - no exchange
    //    - uncollateralized exchange
    //    - fully collateralized exchange
    //    - partially collateralized exchange

    const tests = [
      {
        args: { depositToken: [1, 2], depositWei: [3, 4] },
        isWithdrawal: false,
        name: 'should invalidate all pending deposits',
      },

      {
        args: { weiToSell: '1' },
        chan: { balanceWei: [0, 1] },
        isWithdrawal: true,
        name: 'should invalidate all pending withdrawals without exchange',
      },

      {
        args: { tokensToSell: '5' },
        chan: { balanceWei: [1, 0], balanceToken: [0, 5]},
        isWithdrawal: true,
        name: 'should invalidate all pending withdrawals with ' +
              'token for wei collateralized exchange',
      },

      {
        args: { weiToSell: '1' },
        chan: { balanceWei: [0, 1], balanceToken: [5, 0]},
        isWithdrawal: true,
        name: 'should invalidate all pending withdrawals with ' +
              'wei for token collateralized exchange',
      },

      {
        args: { tokensToSell: '5' },
        chan: { balanceWei: [0, 0], balanceToken: [0, 5]},
        isWithdrawal: true,
        name: 'should invalidate all pending withdrawals with ' +
              'token for wei uncollateralized exchange',
      },

      {
        args: { weiToSell: '1' },
        chan: { balanceWei: [0, 1], balanceToken: [0, 0]},
        isWithdrawal: true,
        name: 'should invalidate all pending withdrawals with ' +
              'wei for token uncollateralized exchange',
      },

      {
        args: { tokensToSell: '10' },
        chan: { balanceWei: [1, 0], balanceToken: [0, 10]},
        isWithdrawal: true,
        name: 'should invalidate all pending withdrawals with ' +
              'token for wei semi-collateralized exchange',
      },

      {
        args: { weiToSell: '2' },
        chan: { balanceWei: [0, 2], balanceToken: [5, 0]},
        isWithdrawal: true,
        name: 'should invalidate all pending withdrawals with ' +
              'wei for token semi-collateralized exchange',
      },
    ]

    const fullWdTests = tests.map((tc: any): any => ({
       ...tc, name: `${tc.name}, full withdrawal`,
    }))

    const partialWdTests = tests.map((tc: any): any => {
      // dynamically add adjusted value to users side
      // while ensuring that the values dont mess up
      // the exchanges
      const adjustment = {
        tokenHub: 4,
        tokenUser: 3,
        weiHub: 2,
        weiUser: 1,
      }
      const updatedWeiBal = [
        (tc.chan && tc.chan.balanceWei ? tc.chan.balanceWei[0] : 0) + adjustment.weiHub,
        (tc.chan && tc.chan.balanceWei ? tc.chan.balanceWei[1] : 0) + adjustment.weiUser,
      ]

      const updatedTokenBal = [
        (tc.chan && tc.chan.balanceToken ? tc.chan.balanceToken[0] : 0) + adjustment.tokenHub,
        (tc.chan && tc.chan.balanceToken ? tc.chan.balanceToken[1] : 0) + adjustment.tokenUser,
      ]

      const updatedArgs = {
        ...tc.args,
        targetTokenHub: adjustment.tokenHub,
        targetTokenUser: adjustment.tokenUser,
        targetWeiHub: adjustment.weiHub,
        targetWeiUser: adjustment.weiUser,
      }

      return {
        ...t,
        args: updatedArgs,
        chan: {
          balanceToken: updatedTokenBal,
          balanceWei: updatedWeiBal,
        },
        name: `${tc.name}, partial withdrawal`,
      }
    })

    t.parameterizedTests(fullWdTests.concat(partialWdTests as any), (tc: any): any => {
      // generate the previous state from the expected balances
      const { args, isWithdrawal, chan } = tc

      const expected = t.getChannelState('empty', {
        txCount: [3, 2],
        ...chan,
      } as any)

      const ar = isWithdrawal
        ? t.getWithdrawalArgs('empty', { ...args, exchangeRate: '5' } as any)
        : t.getDepositArgs('empty', args as any)

      const prev = isWithdrawal
        ? sg.proposePendingWithdrawal(
          convertChannelState('bn', expected),
          convertWithdrawal('bn', ar as any),
        )
      : sg.proposePendingDeposit(
          convertChannelState('bn', expected),
          convertDeposit('bn', ar as any),
        )

      const gen = sg.invalidation(convertChannelState(
          'bn', { ...prev, sigUser: '', sigHub: ''},
      ), isWithdrawal ? { withdrawal: ar } : {} as any)

      assert.deepEqual(
        convertChannelState('str-unsigned', gen),
        convertChannelState('str-unsigned', {
          ...expected,
          recipient: expected.user,
          txCountGlobal: expected.txCountGlobal + 2,
        }),
      )
    })

    // invalidating with states on top
    it('invalidating hub deposits should work on top of channel payments', () => {
      const s0 = createPreviousChannelState({
        balanceToken: [0, 5],
        balanceWei: [0, 10],
      })
      // hub deposit
      const depositArgs = t.getDepositArgs('empty', {
        depositToken: [5, 0],
        depositWei: [0, 0],
        timeout: 0,
      })
      // generate and sign state
      let s1 = sg.proposePendingDeposit(s0, convertDeposit('bn',depositArgs))
      s1 = addSigToChannelState(s1, t.mkHash('0xsig-user'), true)
      s1 = addSigToChannelState(s1, t.mkHash('0xsig-hub'), false)
      t.assertChannelStateEqual(s1 as any, {
        balanceToken: [0, 5],
        balanceWei: [0, 10],
        pendingDepositToken: [5, 0],
      })

      // make a payment
      const paymentArgs = t.getPaymentArgs('empty', {
        amountWei: 2,
        recipient: 'hub',
      })
      // generate and sign state
      let s2 = sg.channelPayment(
        convertChannelState('bn-unsigned',s1) as any, convertPayment('bn',paymentArgs),
      )
      s2 = addSigToChannelState(s2, t.mkHash('0xsig-user'), true)
      s2 = addSigToChannelState(s2, t.mkHash('0xsig-hub'), false)
      t.assertChannelStateEqual(s2 as any, {
        balanceToken: [0, 5],
        balanceWei: [2, 8],
        pendingDepositToken: [5, 0],
      })

      // invalidate state
      const invalid = sg.invalidation(
        convertChannelState('bn-unsigned',s2) as any,
        { reason: 'CU_INVALID_ERROR', invalidTxCount: s1.txCountGlobal, withdrawal: undefined },
      )
      t.assertChannelStateEqual(invalid as any, {
        balanceToken: [0, 5],
        balanceWei: [2, 8],
        pendingDepositToken: [0, 0],
      })
    })

    it('invalidating withdrawals without a timeout should work on top of channel payments', () => {
      const s0 = createPreviousChannelState({
        balanceToken: [5, 0],
        balanceWei: [0, 10],
      })
      // hub wd
      const wdArgs = t.getWithdrawalArgs('empty', {
        targetWeiUser: 10,
        timeout: 0,
      })

      // generate and sign state
      let s1 = sg.proposePendingWithdrawal(s0, convertWithdrawal('bn',wdArgs))
      s1 = addSigToChannelState(s1, t.mkHash('0xsig-user'), true)
      s1 = addSigToChannelState(s1, t.mkHash('0xsig-hub'), false)
      t.assertChannelStateEqual(s1 as any, {
        balanceToken: [0, 0],
        balanceWei: [0, 10],
        pendingWithdrawalToken: [5, 0],
      })

      // make a payment
      const paymentArgs = t.getPaymentArgs('empty', {
        amountWei: 2,
        recipient: 'hub',
      })
      // generate and sign state
      let s2 = sg.channelPayment(
        convertChannelState('bn-unsigned',s1) as any, convertPayment('bn',paymentArgs),
      )
      s2 = addSigToChannelState(s2, t.mkHash('0xsig-user'), true)
      s2 = addSigToChannelState(s2, t.mkHash('0xsig-hub'), false)
      t.assertChannelStateEqual(s2 as any, {
        balanceToken: [0, 0],
        balanceWei: [2, 8],
        pendingWithdrawalToken: [5, 0],
      })

      // invalidate state
      const invalid = sg.invalidation(
        convertChannelState('bn-unsigned',s2) as any,
        { reason: 'CU_INVALID_ERROR', invalidTxCount: s1.txCountGlobal, withdrawal: undefined },
      )
      t.assertChannelStateEqual(invalid as any, {
        balanceToken: [5, 0],
        balanceWei: [2, 8],
        pendingWithdrawalToken: [0, 0],
      })
    })

    // ***** NOTE *****
    // YOU SHOULD NEVER BUILD ON TOP OF STATES WITH TIMEOUTS
    // With this in mind, no need to test pending operations
    // with a withdrawal arg supplied (assumes a timeout state)
  })

  describe('calculateExchange', () => {

    for (const tc of [
      { tokensToSell: 10, expected: { ts: 10, wr: 2 } },
      { tokensToSell: 4, expected: { tr: 4 } },
      { weiToSell: 1, expected: { tr: 5, ws: 1 } },
      { weiToSell: 2, expected: { tr: 10, ws: 2 } },
      { weiToSell: 3, expected: { tr: 3 * 5, ws: 3 } },
    ]) {

      const et: any = {
        exchangeRate: 5,
        tokensToSell: 0,
        weiToSell: 0,
        ...(tc as any),
      }
      et.expected = {
        tr: 0,
        ts: 0,
        wr: 0,
        ws: 0,
        ...et.expected,
      }

      for (const seller of ['user', 'hub']) {
        const flip = (x: number | undefined): any => seller === 'hub' ? (x || 0) * -1 : x
        it(`${seller}:${JSON.stringify(tc)}`, () => {
          const actual = calculateExchange({
            exchangeRate: et.exchangeRate.toString(),
            seller: seller as any,
            tokensToSell: toBN(et.tokensToSell),
            weiToSell: toBN(et.weiToSell),
          })
          assert.deepEqual({
            tokensReceived: actual.tokensReceived.toString(),
            tokensSold: actual.tokensSold.toString(),
            weiReceived: actual.weiReceived.toString(),
            weiSold: actual.weiSold.toString(),
          }, {
              tokensReceived: flip(et.expected.tr).toString(),
              tokensSold: flip(et.expected.ts).toString(),
              weiReceived: flip(et.expected.wr).toString(),
              weiSold: flip(et.expected.ws).toString(),
            })
        })

      }
    }
  })

  describe('openThread', () => {
    it('should create an open thread update with user as sender', async () => {
      const prev = createPreviousChannelState({
        balanceToken: [10, 10],
        balanceWei: [10, 10],
      })

      const args = createPreviousThreadState({
        balanceToken: [10, 0],
        balanceWei: [10, 0],
        sender: prev.user,
      })

      const curr = sg.openThread(prev, [], args)

      assert.deepEqual(curr, createHigherNoncedChannelState(prev, {
        balanceToken: [10, 0],
        balanceWei: [10, 0],
        threadCount: 1,
        threadRoot: utils.generateThreadRootHash([convertThreadState('str', args)]),
      }))
    })

    it('should create an open thread update with user as receiver', async () => {
      const prev = createPreviousChannelState({
        balanceToken: [10, 10],
        balanceWei: [10, 10],
      })

      const args = createPreviousThreadState({
        balanceToken: [10, 0],
        balanceWei: [10, 0],
        receiver: prev.user,
      })

      const curr = sg.openThread(prev, [], args)

      assert.deepEqual(curr, createHigherNoncedChannelState(prev, {
        balanceToken: [0, 10],
        balanceWei: [0, 10],
        threadCount: 1,
        threadRoot: utils.generateThreadRootHash([convertThreadState('str', args)]),
      }))
    })
  })

  describe('closeThread', () => {
    it('should create a close thread update with user as sender', async () => {
      const prev = createPreviousChannelState({
        balanceToken: [10, 0],
        balanceWei: [10, 0],
      })

      const initialThread = createPreviousThreadState({
        balanceToken: [10, 0],
        balanceWei: [10, 0],
        sender: prev.user,
      })

      const currThread = createHigherNoncedThreadState(initialThread, {
        balanceToken: [9, 1],
        balanceWei: [9, 1],
      })

      const curr = sg.closeThread(prev, [convertThreadState('str', initialThread)], currThread)

      assert.deepEqual(curr, createHigherNoncedChannelState(prev, {
        balanceToken: [11, 9],
        balanceWei: [11, 9],
      }))
    })

    it('should create a close thread update with user as receiver', async () => {
      const prev = createPreviousChannelState({
        balanceToken: [0, 10],
        balanceWei: [0, 10],
      })

      const initialThread = createPreviousThreadState({
        balanceToken: [10, 0],
        balanceWei: [10, 0],
        receiver: prev.user,
      })

      const currThread = createHigherNoncedThreadState(initialThread, {
        balanceToken: [9, 1],
        balanceWei: [9, 1],
      })

      const curr = sg.closeThread(prev, [convertThreadState('str', initialThread)], currThread)

      assert.deepEqual(curr, createHigherNoncedChannelState(prev, {
        balanceToken: [9, 11],
        balanceWei: [9, 11],
      }))
    })
  })

  describe('thread payment', () => {
    it('should create a thread payment', async () => {
      const prev = createPreviousThreadState({
        balanceToken: [10, 0],
        balanceWei: [10, 0],
      })

      const payment = {
        amountToken: '10',
        amountWei: '10',
      }

      const curr = sg.threadPayment(prev, convertThreadPayment('bn', payment))

      const check = createHigherNoncedThreadState(prev, {
        balanceToken: [0, 10],
        balanceWei: [0, 10],
      })

      assert.deepEqual(curr, convertThreadState('str-unsigned', check))
    })
  })

  describe('confirmPending', () => {
    it('should confirm a pending deposit', async () => {
      const prev = createPreviousChannelState({
        pendingDepositToken: [8, 4],
        pendingDepositWei: [1, 6],
        recipient: t.mkHash('0x222'),
      })

      // For the purposes of these tests, ensure that the recipient is not the
      // same as the user so we can verify that `confirmPending` will change it
      // back to the user.
      assert.notEqual(prev.recipient, prev.user)

      const curr = sg.confirmPending(prev)

      assert.deepEqual(curr, createHigherNoncedChannelState(prev, {
        balanceToken: [8, 4],
        balanceWei: [1, 6],
        recipient: prev.user,
      }))
    })

    it('should confirm a pending withdrawal', async () => {
      const prev = createPreviousChannelState({
        pendingWithdrawalToken: [8, 4],
        pendingWithdrawalWei: [1, 6],
      })
      const curr = sg.confirmPending(prev)
      assert.deepEqual(curr, createHigherNoncedChannelState(prev, {
        recipient: prev.user,
      }))
    })

    const prefix = 'should confirm a pending withdrawal with a hub deposit into user channel '

    it(`${prefix} equal to withdrawal wei`, async () => {
      const prev = createPreviousChannelState({
        pendingDepositWei: [0, 7],
        pendingWithdrawalToken: [7, 0],
        pendingWithdrawalWei: [0, 7],
      })
      const curr = sg.confirmPending(prev)
      assert.deepEqual(curr, createHigherNoncedChannelState(prev, {
        recipient: prev.user,
      }))
    })

    it(`${prefix} equal to withdrawal token`, async () => {
      const prev = createPreviousChannelState({
        pendingDepositToken: [0, 7],
        pendingWithdrawalToken: [0, 7],
        pendingWithdrawalWei: [7, 0],
      })
      const curr = sg.confirmPending(prev)
      assert.deepEqual(curr, createHigherNoncedChannelState(prev, {
        recipient: prev.user,
      }))
    })

    it(`${prefix} less than withdrawal wei`, async () => {
      const prev = createPreviousChannelState({
        pendingDepositWei: [0, 10],
        pendingWithdrawalToken: [60, 0],
        pendingWithdrawalWei: [0, 15],
      })
      const curr = sg.confirmPending(prev)
      assert.deepEqual(curr, createHigherNoncedChannelState(prev, {
        recipient: prev.user,
      }))
    })

    it(`${prefix} less than withdrawal token`, async () => {
      const prev = createPreviousChannelState({
        pendingDepositToken: [0, 3],
        pendingWithdrawalToken: [0, 15],
        pendingWithdrawalWei: [3, 0],
      })
      const curr = sg.confirmPending(prev)
      assert.deepEqual(curr, createHigherNoncedChannelState(prev, {
        recipient: prev.user,
      }))
    })

    it(`${prefix} greater than withdrawal wei`, async () => {
      const prev = createPreviousChannelState({
        pendingDepositWei: [0, 12],
        pendingWithdrawalWei: [10, 7],
      })
      const curr = sg.confirmPending(prev)
      assert.deepEqual(curr, createHigherNoncedChannelState(prev, {
        balanceWei: [0, 5],
        recipient: prev.user,
      }))
    })

    it(`${prefix} greater than withdrawal token`, async () => {
      const prev = createPreviousChannelState({
        pendingDepositToken: [0, 12],
        pendingWithdrawalToken: [10, 7],
      })
      const curr = sg.confirmPending(prev)
      assert.deepEqual(curr, createHigherNoncedChannelState(prev, {
        balanceToken: [0, 5],
        recipient: prev.user,
      }))
    })
  })
})
