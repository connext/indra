import {
  assert,
  mkHash,
  MockStore,
  parameterizedTests,
  PartialSignedOrSuccinctChannel,
} from '../testing'
import { SyncResult } from '../types'

import * as actions from './actions'

describe('State Middleware', () => {
  describe('handleStateFlags', () => {
    it('should work when user processes deposit', async () => {
      const mock = new MockStore()
      const store = mock.createStore()

      store.dispatch(actions.setSortedSyncResultsFromHub([{
        type: 'channel',
        update: {
          args: {
            depositTokenUser: '1',
            depositWeiUser: '1',
          },
          reason: 'ProposePendingDeposit',
          sigHub: mkHash('0xas'),
          txCount: undefined,
        },
      }]))

      const state = store.getState()

      assert.containSubset(state.runtime, {
        deposit: {
          detected: false,
          submitted: true,
          transactionHash: undefined,
        },
      })
    })

    it('should work when user processes a confirm user withdrawal', async () => {
      const mock = new MockStore()
      mock.setChannel({
        pendingWithdrawalToken: [1, 1],
      })
      const store = mock.createStore()

      store.dispatch(actions.setSortedSyncResultsFromHub([{
        type: 'channel',
        update: {
          args: {
            transactionHash: mkHash('0xAA'),
          },
          reason: 'ConfirmPending',
          sigHub: mkHash('0xas'),
          txCount: undefined,
        },
      }]))

      const state = store.getState()

      assert.containSubset(state.runtime, {
        withdrawal: {
          detected: true,
          submitted: true,
          transactionHash: mkHash('0xAA'),
        },
      })
    })

    parameterizedTests([
      {
        channel: { pendingWithdrawalToken: [1, 0] },
        expected: {
          detected: true,
          submitted: true,
          transactionHash: mkHash('0xAA'),
        },
        name: 'hub decollateralizes token, confirmation',
        sync: [{
          type: 'channel',
          update: {
            args: {
              transactionHash: mkHash('0xAA'),
            },
            reason: 'ConfirmPending',
            sigHub: mkHash('0xas'),
            txCount: undefined,
          },
        }],
      },
      {
        channel: { pendingWithdrawalWei: [1, 0] },
        expected: {
          detected: true,
          submitted: true,
          transactionHash: mkHash('0xAA'),
        },
        name: 'hub decollateralizes wei, confirmation',
        sync: [{
          type: 'channel',
          update: {
            args: {
              transactionHash: mkHash('0xAA'),
            },
            reason: 'ConfirmPending',
            sigHub: mkHash('0xas'),
            txCount: undefined,
          },
        }],
      },
      {
        channel: {  },
        expected: {
          detected: false,
          submitted: true,
          transactionHash: undefined,
        },
        name: 'hub collateralizes, proposed',
        sync: [{
          type: 'channel',
          update: {
            args: {
              depositTokenHub: '1',
              depositTokenUser: '0',
              depositWeiHub: '1',
              depositWeiUser: '0',
            },
            reason: 'ProposePendingDeposit',
            sigHub: mkHash('0xas'),
            txCount: undefined,
          },
        }],
      },
      {
        channel: { balanceToken: [10, 5], balanceWei: [10, 5] },
        expected: {
          detected: false,
          submitted: true,
          transactionHash: undefined,
        },
        name: 'hub decollateralizes, proposed',
        sync: [{
          type: 'channel',
          update: {
            args: {
              targetTokenUser: 5,
              targetWeiUser: 5,
            },
            reason: 'ProposePendingWithdrawal',
            sigHub: mkHash('0xas'),
            txCount: undefined,
          },
        }],
      },
    ], ({ name, channel, expected, sync }: any): any => {
      const mock = new MockStore()
      mock.setChannel(channel as PartialSignedOrSuccinctChannel)
      const store = mock.createStore()

      store.dispatch(actions.setSortedSyncResultsFromHub(sync as SyncResult[]))

      const state = store.getState()

      assert.containSubset(state.runtime, {
        collateral: expected,
      })
    })
  })
})
