import { mkAddress, assert, mkHash, parameterizedTests } from "../testing";
import { MockStore } from "../testing/mocks";
import * as actions from './actions'

describe("handleStateFlags", () => {
  parameterizedTests([
    {
      name: "should work when user processes deposit",
      channel: { 
        balanceToken: [15, 15],
        balanceWei: [15, 15],
      } as any,
      action: 'setSortedSyncResultsFromHub',
      payload: [{
        type: "channel",
        update: {
          reason: "ProposePendingDeposit",
          sigHub: mkHash('0xas'),
          args: {
            depositTokenUser: '1',
            depositWeiUser: '1',
          },
        }
      }],
      expected: {
        deposit: {
          transactionHash: null,
          submitted: true,
          detected: false,
        }
      }
    }
  ], ({ name, channel, action, payload, expected }) => {
    it(name, () => {
      const user = mkAddress('0xAAA')
      const mock = new MockStore()
      const store = mock.createStore()

      mock.setChannel({
        user,
        ...channel,
      })

      store.dispatch((actions as any)[action](payload))

      const state = store.getState()

      assert.containSubset(state.runtime, expected)

    })
  })
})