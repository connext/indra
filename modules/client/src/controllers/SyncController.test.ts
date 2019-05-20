import { StateGenerator } from '../StateGenerator'
import {
  assert,
  getChannelState,
  getThreadState,
  mkAddress,
  mkHash,
  parameterizedTests,
} from '../testing'
import { MockConnextInternal, MockStore } from '../testing/mocks'
import { ChannelUpdateReason, convertChannelState, InvalidationArgs, SyncResult } from '../types'

import { filterPendingSyncResults, mergeSyncResults } from './SyncController'

describe('mergeSyncResults', () => {
  const mkChanResult = (
    txCount: number | undefined,
    sigs: 'hub' | 'user' | 'both' = 'both',
    reason: ChannelUpdateReason = 'Payment',
    createdOn: Date = new Date(),
  ): SyncResult => ({
    type: 'channel',
    update: {
      args: { expectedPos: txCount } as any,
      createdOn,
      reason,
      sigHub: sigs === 'hub' || sigs === 'both' ? 'sig-hub' : undefined,
      sigUser: sigs === 'user' || sigs === 'both' ? 'sig-user' : undefined,
      txCount,
    },
  })

  const mkThreadResult = (
    createdOn: Date | undefined, sigA: string = mkHash(Math.random().toString()),
  ): SyncResult => ({
    type: 'thread',
    update: {
      createdOn, // present once it is added to the hub
      state: getThreadState('full', { sigA }), // signed or unsigned?
    },
  })

  const chanTests = [
    ['empty only channel', [], []],
    ['only old only channel', [], [mkChanResult(1)]],
    ['only new only channel', [mkChanResult(1)], []],
    ['both old only channel', [mkChanResult(1)], [mkChanResult(2)]],
    ['both new only channel', [mkChanResult(2)], [mkChanResult(1)]],
    ['both new only channel', [mkChanResult(1)], [mkChanResult(1)]],
    ['mixed only channel', [mkChanResult(1), mkChanResult(2)], [mkChanResult(3), mkChanResult(2)]],
  ]

  chanTests.forEach(([name, xs, ys]: any): any => {
    it(name as any, () => {
      const actual = mergeSyncResults(xs as any, ys as any)
      const expectedCount = Math.max(
        0,
        ...[...xs as any, ...ys as any].map((x: any): any => x.update.txCount),
      )
      assert.equal(actual.length, expectedCount)

      for (let i = 0; i < actual.length; i += 1) {
        assert.containSubset(actual[i], {
          update: {
            args: {
              expectedPos: i + 1,
            },
            sigHub: 'sig-hub',
            sigUser: 'sig-user',
            txCount: i + 1,
          },
        }, (
            `Mismatch at item ${i + 1}: should have sigHub, sigUser, and expectedPos = ${i + 1}:\n
            ${actual.map((x: any, idx: number): any =>
              `${idx + 1}: ${JSON.stringify(x)}`,
            ).join('\n')}`
          ))
      }
    })
  })

  const today = new Date(1994, 1, 3)
  const earlier = new Date(1994, 1, 2)
  const later = new Date(1994, 1, 4)
  const threadTests = [
    ['only old only threads', [], [mkThreadResult(today)], [mkThreadResult(today)]],

    ['only new only threads', [mkThreadResult(today)], [], [mkThreadResult(today)]],

    ['both old and new only threads', [mkThreadResult(today)], [mkThreadResult(later)],
      [mkThreadResult(today), mkThreadResult(later)]],

    ['both old and new only threads', [mkThreadResult(earlier)], [mkThreadResult(today)],
      [mkThreadResult(earlier), mkThreadResult(today)]],

    ['duplicates only threads', [mkThreadResult(today, mkHash('0xIdentical'))],
      [mkThreadResult(today, mkHash('0xIdentical'))],
      [mkThreadResult(today, mkHash('0xIdentical'))]],

    ['mixed only threads',
      [mkThreadResult(earlier, mkHash('0xearly')), mkThreadResult(today, mkHash('0xtoday'))],
      [mkThreadResult(today, mkHash('0xtoday')), mkThreadResult(later, mkHash('0xlater'))],
      [
        mkThreadResult(earlier, mkHash('0xearly')),
        mkThreadResult(today, mkHash('0xtoday')),
        mkThreadResult(later, mkHash('0xlater')),
      ],
    ],
  ]

  threadTests.forEach(([name, xs, ys, expected]: any): any => {
    it(name as any, () => {
      const actual = mergeSyncResults(xs as any, ys as any)
      assert.equal(actual.length, expected.length)
      for (let i = 0; i < actual.length; i += 1) {
        assert.containSubset(actual[i].update, { createdOn: (expected[i] as any).update.createdOn },
        `Mismatch at item ${i + 1}. Item: ${JSON.stringify(actual[i])}, ` +
        `expected: ${JSON.stringify(expected[i])}`)
      }
    })
  })

  it('should work with both channels and threads', () => {
    const prevChanOps = [mkChanResult(1)]
    const threadOpen = [mkChanResult(2, 'user', 'OpenThread')]
    const threadOps = [mkThreadResult(today), mkThreadResult(later)]
    const threadClose = [mkChanResult(3, 'user', 'CloseThread', later)]

    const oldArr = prevChanOps.concat(threadOpen).concat([threadOps[0]])
    const newArr = threadOpen.concat(threadOps).concat(threadClose)

    const expected = prevChanOps.concat(threadOpen).concat(threadOps).concat(threadClose)

    const actual = mergeSyncResults(oldArr, newArr)

    assert.equal(actual.length, expected.length)
    assert.containSubset(actual, expected)
  })

  it('should not merge sigs', () => {
    const actual = mergeSyncResults([mkChanResult(1, 'user')],
      [mkChanResult(2), mkChanResult(1, 'hub')])
    assert.containSubset(actual[0], {
      update: {
        sigHub:  undefined,
        sigUser: 'sig-user',
        txCount: 1,
      },
    })
    assert.containSubset(actual[1], {
      update: {
        sigHub: 'sig-hub',
        sigUser: undefined,
        txCount: 1,
      },
    })
    assert.containSubset(actual[2], {
      update: {
        sigHub: 'sig-hub',
        sigUser: 'sig-user',
        txCount: 2,
      },
    })
  })

  it('should handle undefined states', () => {
    const actual = mergeSyncResults([mkChanResult(undefined), mkChanResult(1)],
      [mkChanResult(undefined), mkChanResult(2)])
    assert.deepEqual(actual.map((t: any): any => (t.update as any).txCount), [1, 2, undefined])
  })

})

describe('filterPendingSyncResults', () => {
  const mkFromHub = (opts: any, thread: boolean = true): any =>
    thread ? {
      type:  'channel',
      update: {
        reason: 'Payment',
        ...opts,
      },
    } : {
      type: 'thread',
      update: {
        createdOn: new Date(1994, 1, 3),
        ...opts,
      },
    }

  parameterizedTests([
    {
      expected: [ { txCount: 4 } ],
      fromHub: [ mkFromHub({ txCount: 4 }), mkFromHub({ txCount: 5 }) ],
      name: 'toSync contains invalidation',
      toHub: [{
        type: 'channel',
        update: {
          args: {
            lastInvalidTxCount: 5,
            previousValidTxCount: 4,
          },
          reason: 'Invalidation',
          sigUser: true,
          txCount: 6,
        }},
      ],
    },

    {
      expected: [ { txCount: 4 } ],
      fromHub: [ mkFromHub({ txCount: 4 }) ],
      name: 'toHub contains thread updates',
      toHub: [{
        type: 'thread',
        update: {
          state: { sigA: 'sigA'},
        }},
      ],
    },

    {
      expected: [ { txCount: 4 }, { createdOn: new Date(1994, 1, 3) } ],
      fromHub: [ mkFromHub({ txCount: 4 }), mkFromHub({ state: { sigA: 'sigA'} }, false) ],
      name: 'fromHub contains duplicate thread updates',
      toHub: [{
        type: 'thread',
        update: {
          createdOn: new Date(1994, 1, 3),
          state: { sigA: 'sigA'},
        }},
      ],
    },

    {
      expected: [ { sigHub: true, sigUser: true, txCount: 5 } ],
      fromHub: [ mkFromHub({ sigHub: true, sigUser: true, txCount: 5 }) ],
      name: 'results contain state with more sigs',
      toHub: [{
        type: 'channel',
        update: {
          sigUser: true,
          txCount: 5,
        },
      }],
    },

    {
      expected: [ { txCount: 5, sigHub: true, sigUser: true } ],
      fromHub: [ mkFromHub({ txCount: 5, sigHub: true, sigUser: true }) ],
      name: 'results are fully signed signed',
      toHub: [{
        type: 'channel',
        update: {
          sigHub: true,
          sigUser: true,
          txCount: 5,
        },
      }],
    },

    {
      expected: [],
      fromHub: [ mkFromHub({ txCount: 5, sigHub: true }) ],
      name: 'results are less signed',
      toHub: [{
        type: 'channel',
        update: {
          sigHub: true,
          sigUser: true,
          txCount: 5,
        },
      }],
    },

    {
      expected: [],
      fromHub: [ mkFromHub({ id: -69 }) ],
      name: 'unsigned state being synced',
      toHub: [{
        type: 'channel',
        update: {
          id: -69,
          sigUser: true,
        },
      }],
    },

    {
      expected: [ { id: -69 } ],
      fromHub: [ mkFromHub({ id: -69 }) ],
      name: 'unsigned state is new',
      toHub: [],
    },
  ], (tc: any): any => {
    const actual = filterPendingSyncResults(tc.fromHub as any, tc.toHub as any)
    assert.equal(
      actual.length, tc.expected.length,
      `Actual != expected;
       Actual: ${JSON.stringify(actual)}
       Expected: ${JSON.stringify(tc.expected)}`)

    for (let i = 0; i < actual.length; i += 1) {
      assert.containSubset(actual[i].update, tc.expected[i])
    }
  })
})

describe.skip('SyncController.findBlockNearestTimeout', () => {
  const connext = new MockConnextInternal()

  let latestBlockNumber: number | undefined
  connext.provider.getBlock = ((_num: any): any => {
    const num = (_num === 'latest') ? latestBlockNumber : _num
    return Promise.resolve({
      number: num,
      timestamp: num,
    })
  }) as any

  // To simplify testing, assume the timestamp == block.number
  parameterizedTests([
    {
      expectedBlockNumber: 500,
      latestBlockNumber: 500,
      name: 'current block is sufficiently close',
      targetTimestamp: 490,
    },

    {
      expectedBlockNumber: 400,
      latestBlockNumber: 400,
      name: 'current block is before the timeout',
      targetTimestamp: 500,
    },

    {
      expectedBlockNumber: 510,
      latestBlockNumber: 20000,
      name: 'current block is far in the future',
      targetTimestamp: 500,
    },
  ], async (input: any): Promise<any> => {
    latestBlockNumber = input.latestBlockNumber
    const block = await connext.syncController.findBlockNearestTimeout(input.targetTimestamp, 15)
    assert.equal(block.number, input.expectedBlockNumber)
  })

})

describe.skip('SyncController: invalidation handling', () => {
  const user = mkAddress('0xUUU')
  let connext: MockConnextInternal
  const prevStateTimeout = 1000

  const lastValid = getChannelState('empty', {
    balanceToken: [10, 10],
    balanceWei: [10, 10],
    sigHub: mkHash('0xeh197'),
    sigUser: mkHash('0xeh197'),
    timeout: Math.floor(Date.now() / 1000) + 69,
    txCount: [2, 1],
  })

  const prev = getChannelState('empty', {
    ...lastValid,
    pendingDepositToken: [5, 5],
    pendingDepositWei: [5, 5],
    timeout: prevStateTimeout,
    txCount: [4, 1],
  })

  // This is used for both block number and block timestamp. Tests can mutate
  // it to change the value returned from eth provider
  let curBlockTimestamp: number

  beforeEach(async () => {
    const mockStore = new MockStore()
    mockStore.setSyncControllerState([])
    mockStore.setChannel(prev)
    mockStore.setLatestValidState(lastValid)
    mockStore.setChannelUpdate({
      args: {} as any,
      reason: 'ProposePendingDeposit',
      sigHub: '0xsig-hub',
      txCount: 4,
    })

    connext = new MockConnextInternal({
      store: mockStore.createStore(),
      user,
    })

    // stub out block times
    // TODO: fix mock to handle provider better
    connext.provider.getBlockNumber = async (): Promise<any> => curBlockTimestamp
    connext.provider.getBlock = async (): Promise<any> => ({
      number: curBlockTimestamp,
      timestamp: curBlockTimestamp,
    }) as any
  })

  afterEach(() => connext.stop())

  parameterizedTests([
    {
      invalidates: true,
      name: 'invalidation should work',
    },

    {
      curBlockTimestamp: prevStateTimeout - 100,
      invalidates: false,
      name: 'should not invalidate until the timeout has expired',
    },


    {
      eventTxCounts: [prev.txCountGlobal, prev.txCountChain],
      invalidates: false,
      name: 'should not invalidate if the event has been broadcast to chain',
    },

    {
      eventTxCounts: [prev.txCountGlobal - 1, prev.txCountChain - 1],
      invalidates: true,
      name: 'should invalidate if chain event does not match',
    },

  ], async (_test: any): Promise<any> => {
    const test = {
      curBlockTimestamp: prevStateTimeout + 100,
      eventTxCounts: undefined,
      ..._test,
    }

    curBlockTimestamp = test.curBlockTimestamp
    connext.getContractEvents = (eventName: any, fromBlock: any): any =>
      !test.eventTxCounts
        ? []
        : [ { returnValues: { txCount: test.eventTxCounts } } ] as any

    await connext.start()
    await new Promise((res: any): any => setTimeout(res, 20))

    if (test.invalidates) {
      connext.mockHub.assertReceivedUpdate({
        args: {
          lastInvalidTxCount: prev.txCountGlobal,
          previousValidTxCount: lastValid.txCountGlobal,
          reason: 'CU_INVALID_TIMEOUT',
        },
        reason: 'Invalidation',
        sigHub: false,
        sigUser: true,
      })
    } else {
      assert.deepEqual(connext.mockHub.receivedUpdateRequests, [])
    }
  })

  afterEach(async () => {
    await connext.stop()
  })
})

// TODO: changes were made, merged into WIP PR 12/13
// these tests must be revisited in addition to other found bugs.
describe.skip('SyncController: unit tests (ConfirmPending)', () => {
  const user = mkAddress('0xUUU')
  let connext: MockConnextInternal
  const mockStore = new MockStore()

  const initialChannel = getChannelState('empty', {
    pendingDepositToken: [10, 10],
    pendingDepositWei: [10, 10],
    timeout: Math.floor(Date.now() / 1000) + 69,
    txCount: [1, 1],
  })

  beforeEach(async () => {
    connext = new MockConnextInternal({ user })
    // NOTE: this validator depends on the eth provider
    // have it just return the generated state
    connext.validator.generateConfirmPending = (prev: any, args: any): any =>
      new StateGenerator().confirmPending(convertChannelState('bn', initialChannel)) as any
    mockStore.setChannel(initialChannel)
  })

  it('should work when hub returns a confirm pending from sync', async () => {
    connext.store = mockStore.createStore()

    connext.hub.sync = (txCountGlobal: number, lastThreadUpdateId: number): any => ([{
      type: 'channel',
      update: {
        args: { transactionHash: mkHash('0x444') },
        reason: 'ConfirmPending',
        sigHub: mkHash('0x9733'),
        txCount: 2,
      },
    }] as any)

    await connext.start()

    // await connext.syncController.sync()

    await new Promise((res: any): any => setTimeout(res, 30))

    connext.mockHub.assertReceivedUpdate({
      args: { transactionHash: mkHash('0x444') },
      reason: 'ConfirmPending',
      sigHub: true,
      sigUser: true,
    })
  }).timeout(15000)

  afterEach(async () => {
    await connext.stop()
  })
})
