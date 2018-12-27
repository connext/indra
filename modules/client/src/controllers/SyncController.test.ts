import { SyncResult, convertChannelState } from '../types'
import { mergeSyncResults } from './SyncController'
import { assert, getChannelState, mkAddress, mkHash } from '../testing'
import { MockConnextInternal, MockStore, MockHub } from '../testing/mocks';
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
    ['merge sigs', [mkResult(1, 'user')], [mkResult(2), mkResult(1, 'hub')]],
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

  it('should handle null states', () => {
    const actual = mergeSyncResults([mkResult(null), mkResult(1)], [mkResult(null), mkResult(2)])
    assert.deepEqual(actual.map(t => (t.update as any).txCount), [1, 2, null])
  })

})

// TODO: changes were made, merged into WIP PR 12/13
// these tests must be revisited in addition to other found bugs. 
describe.skip('SyncController: unit tests (ConfirmPending)', () => {
  const user = mkAddress('0xUUU')
  let connext: MockConnextInternal
  const mockStore = new MockStore()
  const mockHub = new MockHub()

  const initialChannel = getChannelState("empty", {
    pendingDepositWei: [10, 10],
    pendingDepositToken: [10, 10],
    timeout: Math.floor(Date.now() / 1000) + 69,
    txCount: [1, 1],
  })

  beforeEach(async () => {
    connext = new MockConnextInternal({ user, hub: mockHub })
    // NOTE: this validator depends on web3. have it just return
    // the generated state
    connext.validator.generateConfirmPending = (prev, args) => {
      return new StateGenerator().confirmPending(
        convertChannelState("bn", initialChannel)
      ) as any
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





