import { assert } from './testing/index'
import * as t from './testing/index'
import { StateGenerator } from './StateGenerator';
import { Utils } from './Utils';
import { convertChannelState, convertPayment, ChannelStateBN, convertThreadState, ThreadStateBN, convertExchange, convertDeposit, convertWithdrawal, convertThreadPayment } from './types';
import { extractWithdrawalOverrides, createWithdrawalParams } from './testing/extract-withdrawal-states';


const sg = new StateGenerator()
const utils = new Utils()

function createHigherNoncedChannelState(
    prev: ChannelStateBN,
    ...overrides: t.PartialSignedOrSuccinctChannel[]
) {
    const state = t.getChannelState('empty', {
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
    it('should generate a channel payment', async () => {
        const prev = createPreviousChannelState({
            balanceWei: ['10', '0'],
            balanceToken: ['10', '0'],
        })

        const payment = {
            amountToken: '10',
            amountWei: '10',
        }

        const curr = sg.channelPayment(prev, convertPayment("bn", { ...payment, recipient: "user" }))

        assert.deepEqual(curr, createHigherNoncedChannelState(prev, {
            balanceWei: [0, 10],
            balanceToken: [0, 10],
        }))
    })

    it('should create a wei for tokens exchange update', async () => {
        const prev = createPreviousChannelState({
            balanceToken: [100, 0],
            balanceWei: [0, 100],
        })

        const args = convertExchange('bn', {
            exchangeRate: '0.25',
            tokensToSell: '0',
            weiToSell: '100'
        })

        const curr = sg.exchange(prev, args)

        assert.deepEqual(curr, createHigherNoncedChannelState(prev, {
            balanceToken: [75, 25],
            balanceWei: [100, 0]
        }))
    })

    it('should create a tokens for wei exchange update', async () => {
        const prev = createPreviousChannelState({
            balanceToken: [50, 50],
            balanceWei: [100, 0],
        })

        const args = convertExchange('bn', {
            exchangeRate: '0.5',
            tokensToSell: '50',
            weiToSell: '0'
        })

        const curr = sg.exchange(prev, args)

        assert.deepEqual(curr, createHigherNoncedChannelState(prev, {
            balanceToken: [100, 0],
            balanceWei: [0, 100]
        }))
    })

    it('should create a propose pending deposit update', async () => {
        const prev = createPreviousChannelState()

        const args = convertDeposit('bn', {
            depositWeiHub: '10',
            depositWeiUser: '10',
            depositTokenHub: '10',
            depositTokenUser: '10',
            timeout: 600
        })

        const curr = sg.proposePendingDeposit(prev, args)

        assert.deepEqual(curr, createHigherNoncedChannelState(prev, {
            pendingDepositToken: [10, 10],
            pendingDepositWei: [10, 10],
            timeout: 600,
            txCountChain: prev.txCountChain + 1,
        }))
    })

    describe('Withdrawal states', () => {
        extractWithdrawalOverrides().forEach(wd => {
            it(wd.name, async () => {
                const { curr, prev, args } = createWithdrawalParams(wd, "bn")
                const generatedCurr = sg.proposePendingWithdrawal(prev, args)
                assert.deepEqual(generatedCurr, convertChannelState("str", curr))
            })
        })
    })

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

    it('should confirm a pending deposit', async () => {
        const prev = createPreviousChannelState({
            pendingDepositToken: [10, 10],
            pendingDepositWei: [10, 10],
        })

        const curr = sg.confirmPending(prev)

        assert.deepEqual(curr, createHigherNoncedChannelState(prev, {
            balanceToken: [10, 10],
            balanceWei: [10, 10],
        }))
    })

    it('should confirm a pending withdrawal', async () => {
        const prev = createPreviousChannelState({
            pendingWithdrawalToken: [10, 10],
            pendingWithdrawalWei: [10, 10],
        })

        const curr = sg.confirmPending(prev)

        assert.deepEqual(curr, createHigherNoncedChannelState(prev))
    })
})
