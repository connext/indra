import { mkAddress, assert, mkHash } from "../testing";
import { MockStore } from "../testing/mocks";
import * as actions from './actions'

describe("handleStateFlags", () => {
  it("should work when user processes deposit", async () => {
    const user = mkAddress('0xAAA')
    const mock = new MockStore()
    const store = mock.createStore()

    mock.setChannel({
      user,
      balanceToken: [15, 15],
      balanceWei: [15, 15],
      txCountGlobal: 2,
      txCountChain: 2,
    })

    store.dispatch(actions.setSortedSyncResultsFromHub([{
      type: "channel",
      update: {
        reason: "ProposePendingDeposit",
        sigHub: mkHash('0xas'),
        args: {
          depositTokenUser: '1',
          depositWeiUser: '1',
        },
        txCount: 2,
        createdOn: new Date(),
        id: 1,
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
})