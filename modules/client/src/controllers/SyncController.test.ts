import { SyncResult, convertChannelState, InvalidationArgs, UpdateRequest, convertVerboseEvent, unsignedChannel } from '../types'
import { mergeSyncResults, filterPendingSyncResults } from './SyncController'
import { assert, getChannelState, mkAddress, mkHash, parameterizedTests, updateObj, getChannelStateUpdate } from '../testing'
import { MockConnextInternal, MockStore, MockHub, MockWeb3, patch } from '../testing/mocks';
import { StateGenerator } from '../StateGenerator';
// @ts-ignore
global.fetch = require('node-fetch-polyfill');

describe('mergeSyncResults', () => {
  function mkResult(txCount: number | null, sigs: 'hub' | 'user' | 'both' = 'both'): SyncResult {
    return {
      type: 'channel',
      update: {
        reason: 'Payment',
        args: { expectedPos: txCount } as any,
        txCount,
        sigHub: sigs == 'hub' || sigs == 'both' ? 'sig-hub' : undefined,
        sigUser: sigs == 'user' || sigs == 'both' ? 'sig-user' : undefined,
      },
    }
  }

  const tests = [
    ['empty', [], []],
    ['only old', [], [mkResult(1)]],
    ['only new', [mkResult(1)], []],
    ['both old', [mkResult(1)], [mkResult(2)]],
    ['both new', [mkResult(2)], [mkResult(1)]],
    ['both new', [mkResult(1)], [mkResult(1)]],
    ['mixed', [mkResult(1), mkResult(2)], [mkResult(3), mkResult(2)]],
  ]

  tests.forEach(([name, xs, ys]) => {
    it(name as any, () => {
      const actual = mergeSyncResults(xs as any, ys as any)
      const expectedCount = Math.max(0, ...[...xs as any, ...ys as any].map(x => x.update.txCount))
      assert.equal(actual.length, expectedCount)

      for (let i = 0; i < actual.length; i += 1) {
        assert.containSubset(actual[i], {
          update: {
            args: {
              expectedPos: i + 1,
            },
            txCount: i + 1,
            sigHub: 'sig-hub',
            sigUser: 'sig-user',
          },
        }, (
            `Mismatch at item ${i + 1}: should have sigHub, sigUser, and expectedPos = ${i + 1}:\n` +
            actual.map((x, idx) => `${idx + 1}: ${JSON.stringify(x)}`).join('\n')
          ))
      }
    })
  })

  it('should not merge sigs', () => {
    const actual = mergeSyncResults([mkResult(1, 'user')], [mkResult(2), mkResult(1, 'hub')])
    assert.containSubset(actual[0], {
      update: {
        txCount: 1,
        sigUser: 'sig-user',
        sigHub: undefined,
      },
    })
    assert.containSubset(actual[1], {
      update: {
        txCount: 1,
        sigUser: undefined,
        sigHub: 'sig-hub',
      },
    })
    assert.containSubset(actual[2], {
      update: {
        txCount: 2,
        sigUser: 'sig-user',
        sigHub: 'sig-hub',
      },
    })
  })

  it('should handle null states', () => {
    const actual = mergeSyncResults([mkResult(null), mkResult(1)], [mkResult(null), mkResult(2)])
    assert.deepEqual(actual.map(t => (t.update as any).txCount), [1, 2, null])
  })

})

describe('filterPendingSyncResults', () => {
  function mkFromHub(opts: any) {
    return {
      type: 'channel',
      update: {
        reason: 'Payment',
        ...opts,
      },
    }
  }

  parameterizedTests([
    {
      name: 'toSync contains invalidation',

      fromHub: [mkFromHub({ txCount: 4 }), mkFromHub({ txCount: 5 })],

      toHub: [
        {
          reason: 'Invalidation',
          args: {
            previousValidTxCount: 4,
            lastInvalidTxCount: 5,
          },
          sigUser: true,
          txCount: 6,
        },
      ],

      expected: [{ txCount: 4 }],
    },

    {
      name: 'results contain state with more sigs',

      fromHub: [
        mkFromHub({
          txCount: 5,
          sigHub: true,
          sigUser: true,
        })
      ],

      toHub: [
        {
          txCount: 5,
          sigUser: true,
        },
      ],

      expected: [
        {
          txCount: 5,
          sigHub: true,
          sigUser: true,
        },
      ],
    },

    {
      name: 'results are fully signed signed',

      fromHub: [mkFromHub({ txCount: 5, sigHub: true, sigUser: true })],

      toHub: [
        {
          txCount: 5,
          sigHub: true,
          sigUser: true,
        },
      ],

      expected: [
        {
          txCount: 5,
          sigHub: true,
          sigUser: true,
        },
      ],
    },

    {
      name: 'results are less signed',

      fromHub: [mkFromHub({ txCount: 5, sigHub: true })],

      toHub: [
        {
          txCount: 5,
          sigHub: true,
          sigUser: true,
        },
      ],

      expected: [],
    },

    {
      name: 'unsigned state being synced',

      fromHub: [mkFromHub({ id: -69 })],

      toHub: [
        {
          id: -69,
          sigUser: true,
        },
      ],

      expected: [],
    },

    {
      name: 'unsigned state is new',

      fromHub: [mkFromHub({ id: -69 })],

      toHub: [],

      expected: [
        { id: -69 },
      ],
    },
  ], tc => {
    const actual = filterPendingSyncResults(tc.fromHub as any, tc.toHub as any)
    assert.equal(
      actual.length, tc.expected.length,
      `Actual != expected;\n` +
      `Actual: ${JSON.stringify(actual)}\n` +
      `Expected: ${JSON.stringify(tc.expected)}`
    )

    for (let i = 0; i < actual.length; i += 1)
      assert.containSubset(actual[i].update, tc.expected[i])
  })
})

describe('SyncController.findBlockNearestTimeout', () => {
  const connext = new MockConnextInternal()

  let latestBlockNumber: number | null = null
  connext.opts.web3.eth.getBlock = ((num: any) => {
    if (num == 'latest')
      num = latestBlockNumber
    return Promise.resolve({
      timestamp: num,
      number: num,
    })
  }) as any

  // To simplify testing, assume the timestamp == block.number
  parameterizedTests([
    {
      name: 'current block is sufficiently close',
      latestBlockNumber: 500,
      targetTimestamp: 490,
      expectedBlockNumber: 500,
    },

    {
      name: 'current block is before the timeout',
      latestBlockNumber: 400,
      targetTimestamp: 500,
      expectedBlockNumber: 400,
    },

    {
      name: 'current block is far in the future',
      latestBlockNumber: 20000,
      targetTimestamp: 500,
      expectedBlockNumber: 510,
    },
  ], async input => {
    latestBlockNumber = input.latestBlockNumber
    const block = await connext.syncController.findBlockNearestTimeout(input.targetTimestamp, 15)
    assert.equal(block.number, input.expectedBlockNumber)
  })

})

describe("SyncController: invalidation handling", () => {
  const user = mkAddress('0xUUU')
  let connext: MockConnextInternal
  const prevStateTimeout = 1000

  const lastValid = getChannelState("empty", {
    balanceToken: [10, 10],
    balanceWei: [10, 10],
    timeout: Math.floor(Date.now() / 1000) + 69,
    txCount: [2, 1],
    sigHub: mkHash('0xeh197'),
    sigUser: mkHash('0xeh197'),
  })

  const prev = getChannelState("empty", {
    ...lastValid,
    pendingDepositToken: [5, 5],
    pendingDepositWei: [5, 5],
    timeout: prevStateTimeout,
    txCount: [4, 1]
  })

  // This is used for both block number and block timestamp. Tests can mutate
  // it to change the value returned by web3
  let curBlockTimestamp: number

  beforeEach(async () => {
    const mockStore = new MockStore()
    mockStore.setSyncControllerState([])
    mockStore.setChannel(prev)
    mockStore.setLatestValidState(lastValid)
    mockStore.setChannelUpdate({
      reason: 'ProposePendingDeposit',
      txCount: 4,
      args: {} as any,
      sigHub: '0xsig-hub',
    })

    // update web3 functions to return mocked values
    const mocked = new MockWeb3()

    connext = new MockConnextInternal({
      user,
      store: mockStore.createStore(),
    })

    // stub out block times
    // TODO: fix mock web3 to handle provider better
    connext.opts.web3.eth.getBlockNumber = async () => {
      return curBlockTimestamp
    }
    connext.opts.web3.eth.getBlock = async () => {
      return {
        number: curBlockTimestamp,
        timestamp: curBlockTimestamp,
      } as any
    }
  })

  afterEach(() => {
    return connext.stop()
  })

  parameterizedTests([
    {
      name: 'invalidation should work',
      invalidates: true,
    },

    {
      name: 'should not invalidate until the timeout has expired',
      curBlockTimestamp: prevStateTimeout - 100,
      invalidates: false,
    },


    {
      name: 'should not invalidate if the event has been broadcast to chain',
      eventTxCounts: [prev.txCountGlobal, prev.txCountChain],
      invalidates: false,
    },

    {
      name: 'should invalidate if chain event does not match',
      eventTxCounts: [prev.txCountGlobal - 1, prev.txCountChain - 1],
      invalidates: true,
    },

  ], async _test => {
    const test = {
      curBlockTimestamp: prevStateTimeout + 100,
      eventTxCounts: null,
      ..._test,
    }

    curBlockTimestamp = test.curBlockTimestamp
    connext.getContractEvents = (eventName, fromBlock) => {
      return !test.eventTxCounts ? [] : [
        {
          returnValues: {
            txCount: test.eventTxCounts,
          },
        },
      ] as any
    }

    await connext.start()
    await new Promise(res => setTimeout(res, 20))

    if (test.invalidates) {
      connext.mockHub.assertReceivedUpdate({
        reason: "Invalidation",
        args: {
          previousValidTxCount: lastValid.txCountGlobal,
          lastInvalidTxCount: prev.txCountGlobal,
          reason: "CU_INVALID_TIMEOUT",
        } as InvalidationArgs,
        sigUser: true,
        sigHub: false,
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

  const initialChannel = getChannelState("empty", {
    pendingDepositWei: [10, 10],
    pendingDepositToken: [10, 10],
    timeout: Math.floor(Date.now() / 1000) + 69,
    txCount: [1, 1],
  })

  beforeEach(async () => {
    connext = new MockConnextInternal({ user })
    // NOTE: this validator depends on web3. have it just return
    // the generated state
    connext.validator.generateConfirmPending = async (prev, args) => {
      return new StateGenerator().confirmPending(
        convertChannelState("bn", prev),
      )
    }
    mockStore.setChannel(initialChannel)
  })

  it('should work when hub returns a confirm pending from sync', async () => {
    connext.store = mockStore.createStore()

    connext.hub.sync = (txCountGlobal: number, lastThreadUpdateId: number) => {
      return [{
        type: "channel",
        update: {
          reason: "ConfirmPending",
          sigHub: mkHash('0x9733'),
          txCount: 2,
          args: { transactionHash: mkHash('0x444') }
        },
      }] as any
    }

    await connext.start()

    // await connext.syncController.sync()

    await new Promise(res => setTimeout(res, 30))

    connext.mockHub.assertReceivedUpdate({
      reason: 'ConfirmPending',
      args: { transactionHash: mkHash('0x444') },
      sigUser: true,
      sigHub: true,
    })
  }).timeout(15000)

  afterEach(async () => {
    await connext.stop()
  })
})