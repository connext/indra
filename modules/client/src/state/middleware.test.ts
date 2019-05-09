import { assert, mkHash, parameterizedTests, PartialSignedOrSuccinctChannel } from "../testing";
import { MockStore } from "../testing/mocks";
import * as actions from './actions'
import { SyncResult } from "../types";

describe("handleStateFlags", () => {
  it("should work when user processes deposit", async () => {
    const mock = new MockStore()
    const store = mock.createStore()

    store.dispatch(actions.setSortedSyncResultsFromHub([{
      type: "channel",
      update: {
        reason: "ProposePendingDeposit",
        sigHub: mkHash('0xas'),
        args: {
          depositTokenUser: '1',
          depositWeiUser: '1',
        },
        txCount: null
      }
    }]))

    const state = store.getState()

    assert.containSubset(state.runtime, {
      deposit: {
        transactionHash: null,
        submitted: true,
        detected: false,
      }
    })
  })

  it("should work when user processes a confirm user withdrawal", async () => {
    const mock = new MockStore()
    mock.setChannel({
      pendingWithdrawalToken: [1, 1]
    })
    const store = mock.createStore()

    store.dispatch(actions.setSortedSyncResultsFromHub([{
      type: "channel",
      update: {
        reason: "ConfirmPending",
        sigHub: mkHash('0xas'),
        args: {
          transactionHash: mkHash("0xAA"),
        },
        txCount: null,
      }
    }]))

    const state = store.getState()

    assert.containSubset(state.runtime, {
      withdrawal: {
        transactionHash: mkHash("0xAA"),
        submitted: true,
        detected: true,
      }
    })
  })

  parameterizedTests([
    {
      name: "hub decollateralizes token, confirmation",
      channel: { pendingWithdrawalToken: [1, 0], },
      expected: {
        transactionHash: mkHash("0xAA"),
        submitted: true,
        detected: true,
      },
      sync: [{
        type: "channel",
        update: {
          reason: "ConfirmPending",
          sigHub: mkHash('0xas'),
          args: {
            transactionHash: mkHash("0xAA"),
          },
          txCount: null,
        }
      }]
    },
    {
      name: "hub decollateralizes wei, confirmation",
      channel: { pendingWithdrawalWei: [1, 0], },
      expected: {
        transactionHash: mkHash("0xAA"),
        submitted: true,
        detected: true,
      },
      sync: [{
        type: "channel",
        update: {
          reason: "ConfirmPending",
          sigHub: mkHash('0xas'),
          args: {
            transactionHash: mkHash("0xAA"),
          },
          txCount: null,
        }
      }]
    },
    {
      name: "hub collateralizes, proposed",
      channel: {  },
      expected: {
        transactionHash: null,
        submitted: true,
        detected: false,
      },
      sync: [{
        type: "channel",
        update: {
          reason: "ProposePendingDeposit",
          sigHub: mkHash('0xas'),
          args: {
            depositTokenHub: '1',
            depositWeiHub: '1',
            depositTokenUser: '0',
            depositWeiUser: '0',
          },
          txCount: null,
        }
      }]
    },
    {
      name: "hub decollateralizes, proposed",
      channel: { balanceToken: [10, 5], balanceWei: [10, 5] },
      expected: {
        transactionHash: null,
        submitted: true,
        detected: false,
      },
      sync: [{
        type: "channel",
        update: {
          reason: "ProposePendingWithdrawal",
          sigHub: mkHash('0xas'),
          args: {
            targetTokenUser: 5,
            targetWeiUser: 5,
          },
          txCount: null,
        }
      }]
    },
  ], ({ name, channel, expected, sync }) => {
    const mock = new MockStore()
    mock.setChannel(channel as PartialSignedOrSuccinctChannel)
    const store = mock.createStore()

    store.dispatch(actions.setSortedSyncResultsFromHub(sync as SyncResult[]))

    const state = store.getState()

    assert.containSubset(state.runtime, {
      collateral: expected
    })
  })
})