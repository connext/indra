import { assert, getThreadState, mkAddress, parameterizedTests, mkHash } from '../testing';
import { MockStore, MockConnextInternal, MockHub } from '../testing/mocks';
import { PaymentArgs, SyncResult, ChannelUpdateReason } from '../types';
// @ts-ignore
global.fetch = require('node-fetch-polyfill');

/*
StateUpdateController is used by all the other controllers to handle various types of state updates that are present in the `runtime.syncResultsFromHub` state. To do this, it subscribes to the store, and handles the the updates from the hub in the `handleSyncItem` method. As it is an internal controller with no public API there are no unit tests written.
*/

const receiver = "0x22597df3d913c197b4d8f01a3530114847c20832"
const user = "0xc55eddadeeb47fcde0b3b6f25bd47d745ba7e7fa"

describe('StateUpdateController: thread payments', () => {
  const user = mkAddress('0xAAA')
  let connext: MockConnextInternal

  parameterizedTests([
    {
      name: 'accept thread payment as sender',
      receiver: false,
    },

    {
      name: 'close thread if received thread payment',
      receiver: true,
    },
  ], async tc => {
    const mockStore = new MockStore()
    mockStore.setChannel({
      user: tc.receiver ? receiver : user,
      balanceToken: [15, 15],
      balanceWei: [15, 15],
      txCountGlobal: 2,
      txCountChain: 2,
    })

    mockStore.addThread({
      receiver,
      txCount: 0,
      balanceToken: [10, 0],
      balanceWei: [2, 0],
    })

    connext = new MockConnextInternal({
      user,
      store: mockStore.createStore(),
    })

    await connext.start()

    const res = connext.stateUpdateController.handleSyncItem({
      type: 'thread',
      update: {
        state: getThreadState('full', {
          receiver,
          balanceToken: [9, 1],
          balanceWei: [2, 0]
        }),
        id: 69
      },
    })

    if ((tc as any).shouldFailWith) {
      await assert.isRejected(res, (tc as any).shouldFailWith)
      assert.deepEqual(connext.mockHub.receivedUpdateRequests, [])
    } else if (!tc.receiver) {
      await res
      assert.deepEqual(connext.mockHub.receivedUpdateRequests, [])
    } else {
      await res
      connext.mockHub.assertReceivedUpdate({
        reason: 'CloseThread',
        args: {
          receiver,
          balanceTokenReceiver: '1',
          balanceTokenSender: '9',
        },
        sigUser: true,
        sigHub: false,
      })
    }

  })

  afterEach(async () => {
    await connext.stop()
  })
})

describe("StateUpdateController: hub to user payments", () => {
  let connext: MockConnextInternal

  parameterizedTests([
    {
      name: "should work for hub to user token payments",
      syncResults: [{
        type: "channel",
        update: {
          reason: "Payment",
          args: {
            recipient: "user",
            amountToken: '1',
            amountWei: '0',
          },
          txCount: 1,
          sigHub: mkHash('0x51512'),
          createdOn: new Date()
        },
      }],
    },
    {
      name: "should fail for invalid payments from hub to user",
      syncResults: [{
        type: "channel",
        update: {
          reason: "Payment",
          args: {
            recipient: "user",
            amountToken: '-1',
            amountWei: '0',
          },
          txCount: 1,
          sigHub: mkHash('0x51512'),
          createdOn: new Date()
        },
      }],
      fails: /There were 1 negative fields detected/
    },
    {
      name: "should fail if the update returned by hub to sync queue is unsigned by hub",
      syncResults: [{
        type: "channel",
        update: {
          reason: "Payment",
          args: {
            recipient: "hub",
            amountToken: '1',
            amountWei: '1',
          },
          txCount: 1,
          sigHub: '',
        },
      }],
      fails: /sigHub not detected in update/
    },
    {
      name: "should fail if the update returned by hub to sync queue is unsigned by user and directed to hub",
      syncResults: [{
        type: "channel",
        update: {
          reason: "Payment",
          args: {
            recipient: "hub",
            amountToken: '1',
            amountWei: '1',
          } as PaymentArgs,
          txCount: 1,
          sigHub: mkHash('0x90283'),
          sigUser: '',
        },
      }],
      fails: /sigUser not detected in update/
    }
  ], async ({ name, syncResults, fails }) => {
    const mockStore = new MockStore()
    mockStore.setChannel({
      user,
      balanceWei: [5, 5],
      balanceToken: [10, 10],
    })
    mockStore.setSyncResultsFromHub(syncResults as SyncResult[])
    connext = new MockConnextInternal({
      user,
      store: mockStore.createStore()
    })

    if (fails) {
      await assert.isRejected(connext.start(), fails)
      return
    }

    await connext.start()

    await new Promise(res => setTimeout(res, 20))

    for (const res of syncResults) {
      connext.mockHub.assertReceivedUpdate({
        reason: res.update.reason as ChannelUpdateReason,
        args: res.update.args,
        sigUser: true,
        sigHub: true,
      })
    }
  })

  afterEach(async () => {
    await connext.stop()
  })
})

describe.skip('StateUpdateController: invalidation handling', () => {
  const user = mkAddress('0xUUU')
  let connext: MockConnextInternal

  parameterizedTests([
    {
      name: 'reject invalidation that has not timed out',
      timeout: 1000,
      blockTimestamp: 500,
      shouldFailWith: /Hub proposed an invalidation for an update that has not yet timed out/
    },

    {
      name: 'accept a valid invalidation',
      timeout: 1000,
      blockTimestamp: 2000,
    },

  ], async tc => {
    const mockStore = new MockStore()
    mockStore.setChannel({
      pendingWithdrawalTokenUser: '100',
      txCountGlobal: 2,
      txCountChain: 2,
      timeout: tc.timeout,
    })

    mockStore.setLatestValidState({
      txCountGlobal: 1,
      txCountChain: 1,
    })

    connext = new MockConnextInternal({
      user,
      store: mockStore.createStore(),
    })

    connext.provider.getBlock = async () => {
      return {
        timestamp: tc.blockTimestamp,
      } as any
    }

    await connext.start()

    const res = connext.stateUpdateController.handleSyncItem({
      type: 'channel',
      update: {
        reason: 'Invalidation',
        txCount: 3,
        args: {
          previousValidTxCount: 1,
          lastInvalidTxCount: 2,
          reason: "CU_INVALID_TIMEOUT",
        },
        sigHub: '0xsig-hub',
      },
    })

    if (tc.shouldFailWith) {
      await assert.isRejected(res, tc.shouldFailWith)
      assert.deepEqual(connext.mockHub.receivedUpdateRequests, [])
    } else {
      await res
      connext.mockHub.assertReceivedUpdate({
        reason: 'Invalidation',
        args: {
          previousValidTxCount: 1,
          lastInvalidTxCount: 2,
          reason: 'CU_INVALID_TIMEOUT',
        },
        sigUser: true,
        sigHub: true,
      })
    }

  })

  afterEach(async () => {
    await connext.stop()
  })
})
