import { assert } from './testing/index'
import * as t from './testing/index'
import { StateGenerator, calculateExchange } from './StateGenerator';
import { Utils } from './Utils';
import { convertChannelState, convertPayment, ChannelStateBN, convertThreadState, ThreadStateBN, convertExchange, convertDeposit, convertWithdrawal, convertThreadPayment, ChannelState, WithdrawalArgs, convertFields } from './types';
import { getChannelState, getWithdrawalArgs } from './testing'
import { toBN } from './helpers/bn'


const sg = new StateGenerator()
const utils = new Utils()

function createHigherNoncedChannelState(
  prev: ChannelStateBN,
  ...overrides: t.PartialSignedOrSuccinctChannel[]
) {
  const state = t.getChannelState('empty', {
    recipient: prev.user,
    ...overrides[0],
    txCountGlobal: prev.txCountGlobal + 1,
  })
  return convertChannelState("str-unsigned", state)
}

function createHigherNoncedThreadState(
  prev: ThreadStateBN,
  ...overrides: t.PartialSignedOrSuccinctThread[]
) {
  const state = t.getThreadState('empty', {
    ...prev, // for address vars
    ...overrides[0],
    txCount: prev.txCount + 1,
  })
  return convertThreadState("str-unsigned", state)
}

function createPreviousChannelState(...overrides: t.PartialSignedOrSuccinctChannel[]) {
  const state = t.getChannelState('empty', {
    user: t.mkAddress('0xAAA'),
    recipient: t.mkAddress('0xAAA'),
    ...overrides[0],
    sigUser: t.mkHash('booty'),
    sigHub: t.mkHash('errywhere'),
  })
  return convertChannelState("bn", state)
}

function createPreviousThreadState(...overrides: t.PartialSignedOrSuccinctThread[]) {
  const state = t.getThreadState('empty', {
    ...overrides[0],
    sigA: t.mkHash('peachy'),
  })
  return convertThreadState("bn", state)
}

describe('StateGenerator', () => {
  describe('channel payment', () => {
    it('should generate a channel payment', async () => {
      const prev = createPreviousChannelState({
        balanceWei: ['3', '0'],
        balanceToken: ['2', '0'],
      })

      const payment = {
        amountToken: '2',
        amountWei: '3',
      }

      const curr = sg.channelPayment(prev, convertPayment("bn", { ...payment, recipient: "user" }))

      assert.deepEqual(curr, createHigherNoncedChannelState(prev, {
        balanceWei: [0, 3],
        balanceToken: [0, 2],
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
        tokensToSell: 0,
        weiToSell: 3,
        seller: "user"
      })

      const curr = sg.exchange(prev, args)

      assert.deepEqual(curr, createHigherNoncedChannelState(prev, {
        balanceToken: [0, 17],
        balanceWei: [8, 0]
      }))
    })

    it('should create a tokens for wei exchange update', async () => {
      const prev = createPreviousChannelState({
        balanceToken: [17, 50],
        balanceWei: [25, 3],
      })

      const args = convertExchange('bn', {
        exchangeRate: '5',
        tokensToSell: '25',
        weiToSell: '0',
        seller: "user"
      })

      const curr = sg.exchange(prev, args)

      assert.deepEqual(curr, createHigherNoncedChannelState(prev, {
        balanceToken: [42, 25],
        balanceWei: [20, 8]
      }))
    })
  })

  describe('deposit', () => {
    it('should create a propose pending deposit update', async () => {
      const prev = createPreviousChannelState()

      const args = convertDeposit('bn', {
        depositWeiHub: '5',
        depositWeiUser: '3',
        depositTokenHub: '1',
        depositTokenUser: '9',
        timeout: 600
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

  type WDTest = {
    name: string
    prev: Partial<ChannelState<number>>
    args: Partial<WithdrawalArgs<number>>
    expected: Partial<ChannelState<number>>
  }

  const exchangeRate = 5
  const withdrawalTests: WDTest[] = [
    {
      name: 'Simple sell tokens',
      prev: {
        balanceTokenUser: 7,
      },
      args: {
        tokensToSell: 5,
      },
      expected: {
        balanceTokenUser: 2,
        pendingWithdrawalTokenHub: 5,
        pendingDepositWeiUser: 1,
        pendingWithdrawalWeiUser: 1,
      },
    },

    {
      name: 'Sell tokens, withdraw wei, hub deposit tokens',
      prev: {
        balanceTokenUser: 7,
        balanceWeiUser: 6,
      },
      args: {
        tokensToSell: 5,
        targetWeiUser: 4,
        targetTokenHub: 20,
      },
      expected: {
        balanceTokenHub: 5,
        balanceWeiUser: 4,
        balanceTokenUser: 2,
        pendingDepositTokenHub: 15,
        pendingWithdrawalWeiUser: 3,
        pendingDepositWeiUser: 1,
      },
    },

    {
      name: 'Sell tokens, increase tokens balance, add some wei to balance',
      prev: {
        balanceTokenUser: 3,
      },
      args: {
        tokensToSell: 1,
        targetWeiUser: 11,
        targetTokenUser: 5,
      },
      expected: {
        pendingDepositWeiUser: 11,
        pendingDepositTokenUser: 2,
      },
    },

    {
      name: 'Hub deposit and withdrawal simplification',
      prev: {
        balanceTokenHub: 11,
        balanceWeiHub: 8,
      },
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
    },

    {
      name: 'Hub send additional wei + tokens',
      prev: {
        balanceTokenHub: 11,
        balanceWeiHub: 11,
        balanceTokenUser: 5,
      },
      args: {
        targetTokenHub: 12,
        targetWeiHub: 13,
        tokensToSell: 5,
        additionalTokenHubToUser: 3,
        additionalWeiHubToUser: 4,
      },
      expected: {
        balanceTokenHub: 12,
        pendingWithdrawalTokenHub: 4,

        balanceWeiHub: 10,
        pendingDepositWeiHub: 3,

        balanceTokenUser: 0,
        pendingDepositTokenUser: 3,
        pendingWithdrawalTokenUser: 3,

        balanceWeiUser: 0,
        pendingDepositWeiUser: 4,
        pendingWithdrawalWeiUser: 5,
      },
    },

    {
      name: 'User withdrawal and hub recollatoralize',
      prev: {
        balanceWeiHub: 10,
        balanceTokenHub: 3,
        balanceWeiUser: 7,
        balanceTokenUser: 5,
      },
      args: {
        targetWeiHub: 0,
        targetTokenHub: 6,
        targetWeiUser: 5,
        tokensToSell: 5,
      },
      expected: {
        balanceWeiHub: 0,
        balanceWeiUser: 5,
        balanceTokenUser: 0,
        balanceTokenHub: 6,
        pendingWithdrawalWeiHub: 9,
        pendingWithdrawalWeiUser: 3,
        pendingWithdrawalTokenHub: 2,
      },
    },

    {
      name: 'Token sale and hub adds additional tokens',
      prev: {
        balanceTokenUser: 17,
      },
      args: {
        tokensToSell: 15,
        targetWeiUser: 1,
        targetTokenHub: 20,
      },
      expected: {
        balanceWeiUser: 0,
        balanceTokenUser: 2,
        pendingDepositWeiUser: 3,
        pendingWithdrawalWeiUser: 2,
        balanceTokenHub: 15,
        pendingDepositTokenHub: 5,
      },
    },
  ]

  const args2Str = (args: any) => {
    return Object.entries(args).map((x: any) => `${x[0]}: ${x[1]}`).join(', ')
  }

  describe('Withdrawal states', () => {
    withdrawalTests.forEach(tc => {
      it(tc.name + ': ' + args2Str(tc.args), () => {
        const prev = convertChannelState('bn', getChannelState('empty', tc.prev))
        const args = convertWithdrawal('bn', getWithdrawalArgs('empty', tc.args, {
          exchangeRate: exchangeRate.toString(),
        }))
        const s = convertChannelState('str-unsigned', sg.proposePendingWithdrawal(prev, args))

        const expected = {
          ...prev,
          ...tc.expected,
          txCountGlobal: 2,
          txCountChain: 2,
          timeout: 6969,
        }

        assert.deepEqual(s, convertChannelState('str-unsigned', expected))
      })
    })
  })

  describe('calculateExchange', () => {
    type ExchangeTest = {
      seller: 'user' | 'hub'
      exchangeRate: number
      tokensToSell: number
      weiToSell: number
      expected: Partial<{
        ws: number
        ts: number
        wr: number
        tr: number
      }>
    }

    const exchangeTests: Partial<ExchangeTest>[] = [
      { tokensToSell: 10, expected: { ts: 10, wr: 2 } },
      { tokensToSell: 4, expected: { tr: 4 } },
      { weiToSell: 1, expected: { tr: 5, ws: 1 } },
      { weiToSell: 2, expected: { tr: 10, ws: 2 } },
      { weiToSell: 3, expected: { tr: 3 * 5, ws: 3 } },
    ]

    exchangeTests.forEach(_t => {
      const t: ExchangeTest = {
        exchangeRate: 5,
        tokensToSell: 0,
        weiToSell: 0,
        ...(_t as any),
      }
      t.expected = {
        ws: 0,
        ts: 0,
        wr: 0,
        tr: 0,
        ...t.expected,
      }

      for (const seller of ['user', 'hub']) {
        const flip = (x: number | undefined) => seller == 'hub' ? -x! : x
        it(seller + ': ' + JSON.stringify(_t), () => {
          const actual = calculateExchange({
            exchangeRate: '' + t.exchangeRate,
            seller: seller as any,
            tokensToSell: toBN(t.tokensToSell),
            weiToSell: toBN(t.weiToSell),
          })

          assert.deepEqual({
            weiSold: actual.weiSold.toString(),
            weiReceived: actual.weiReceived.toString(),
            tokensSold: actual.tokensSold.toString(),
            tokensReceived: actual.tokensReceived.toString(),
          }, {
            weiSold: '' + flip(t.expected.ws),
            weiReceived: '' + flip(t.expected.wr),
            tokensSold: '' + flip(t.expected.ts),
            tokensReceived: '' + flip(t.expected.tr),
          })

        })
      }
    })
  })

  describe('openThread', () => {
    it('should create an open thread update with user as sender', async () => {
      const prev = createPreviousChannelState({
        balanceToken: [10, 10],
        balanceWei: [10, 10]
      })

      const args = createPreviousThreadState({
        sender: prev.user,
        balanceWei: [10, 0],
        balanceToken: [10, 0],
      })

      const curr = sg.openThread(prev, [], args)

      assert.deepEqual(curr, createHigherNoncedChannelState(prev, {
        balanceToken: [10, 0],
        balanceWei: [10, 0],
        threadCount: 1,
        threadRoot: utils.generateThreadRootHash([convertThreadState("str", args)]),
      }))
    })

    it('should create an open thread update with user as receiver', async () => {
      const prev = createPreviousChannelState({
        balanceToken: [10, 10],
        balanceWei: [10, 10]
      })

      const args = createPreviousThreadState({
        receiver: prev.user,
        balanceWei: [10, 0],
        balanceToken: [10, 0],
      })

      const curr = sg.openThread(prev, [], args)

      assert.deepEqual(curr, createHigherNoncedChannelState(prev, {
        balanceToken: [0, 10],
        balanceWei: [0, 10],
        threadCount: 1,
        threadRoot: utils.generateThreadRootHash([convertThreadState("str", args)]),
      }))
    })
  })

  describe('closeThread', () => {
    it('should create a close thread update with user as sender', async () => {
      const prev = createPreviousChannelState({
        balanceToken: [10, 0],
        balanceWei: [10, 0]
      })

      const initialThread = createPreviousThreadState({
        sender: prev.user,
        balanceWei: [10, 0],
        balanceToken: [10, 0],
      })

      const currThread = createHigherNoncedThreadState(initialThread, {
        balanceToken: [9, 1],
        balanceWei: [9, 1],
      })

      const curr = sg.closeThread(prev, [convertThreadState("str", initialThread)], convertThreadState("bn-unsigned", currThread))

      assert.deepEqual(curr, createHigherNoncedChannelState(prev, {
        balanceToken: [11, 9],
        balanceWei: [11, 9],
      }))
    })

    it('should create a close thread update with user as receiver', async () => {
      const prev = createPreviousChannelState({
        balanceToken: [0, 10],
        balanceWei: [0, 10]
      })

      const initialThread = createPreviousThreadState({
        receiver: prev.user,
        balanceWei: [10, 0],
        balanceToken: [10, 0],
      })

      const currThread = createHigherNoncedThreadState(initialThread, {
        balanceToken: [9, 1],
        balanceWei: [9, 1],
      })

      const curr = sg.closeThread(prev, [convertThreadState("str", initialThread)], convertThreadState("bn-unsigned", currThread))

      assert.deepEqual(curr, createHigherNoncedChannelState(prev, {
        balanceToken: [9, 11],
        balanceWei: [9, 11],
      }))
    })
  })

  describe('thread payment', () => {
    it('should create a thread payment', async () => {
      const prev = createPreviousThreadState({
        balanceWei: [10, 0],
        balanceToken: [10, 0],
      })

      const payment = {
        amountToken: '10',
        amountWei: '10',
      }

      const curr = sg.threadPayment(prev, convertThreadPayment("bn", payment))

      assert.deepEqual(curr, createHigherNoncedThreadState(prev, {
        balanceToken: [0, 10],
        balanceWei: [0, 10],
      }))
    })
  })

  describe('confirmPending', () => {
    it('should confirm a pending deposit', async () => {
      const prev = createPreviousChannelState({
        pendingDepositToken: [8, 4],
        pendingDepositWei: [1, 6],
        recipient: t.mkHash('0x222')
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

    it('should confirm a pending withdrawal with a hub deposit into user channel equal to withdrawal wei', async () => {
      const prev = createPreviousChannelState({
        pendingDepositWei: [0, 7],
        pendingWithdrawalWei: [0, 7],
        pendingWithdrawalToken: [7, 0],
      })

      const curr = sg.confirmPending(prev)

      assert.deepEqual(curr, createHigherNoncedChannelState(prev, {
        recipient: prev.user,
      }))
    })

    it('should confirm a pending withdrawal with a hub deposit into user channel equal to withdrawal token', async () => {
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

    it('should confirm a pending withdrawal with a hub deposit into user channel less than withdrawal wei', async () => {
      const prev = createPreviousChannelState({
        pendingDepositWei: [0, 10],
        pendingWithdrawalWei: [0, 15],
        pendingWithdrawalToken: [60, 0],
      })

      const curr = sg.confirmPending(prev)

      assert.deepEqual(curr, createHigherNoncedChannelState(prev, {
        recipient: prev.user,
      }))
    })

    it('should confirm a pending withdrawal with a hub deposit into user channel less than withdrawal token', async () => {
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

    it('should confirm a pending withdrawal with a hub deposit into user channel greater than withdrawal wei', async () => {
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

    it('should confirm a pending withdrawal with a hub deposit into user channel greater than withdrawal token', async () => {
      const prev = createPreviousChannelState({
        pendingDepositToken: [0, 12],
        pendingWithdrawalToken: [10, 7],
      })

      const curr = sg.confirmPending(prev)

      assert.deepEqual(curr, createHigherNoncedChannelState(prev, {
        recipient: prev.user,
        balanceToken: [0, 5]
      }))
    })
  })
})
