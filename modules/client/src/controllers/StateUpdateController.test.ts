import { MockStore, MockConnextInternal, MockHub } from '../testing/mocks';
import { mkAddress, getThreadState } from '../testing';
import { assert, parameterizedTests } from '../testing'
// @ts-ignore
global.fetch = require('node-fetch-polyfill');

/*
StateUpdateController is used by all the other controllers to handle various types of state updates that are present in the `runtime.syncResultsFromHub` state. To do this, it subscribes to the store, and handles the the updates from the hub in the `handleSyncItem` method. As it is an internal controller with no public API there are no unit tests written.
*/

const receiver = "0x22597df3d913c197b4d8f01a3530114847c20832"
const user = "0xc55eddadeeb47fcde0b3b6f25bd47d745ba7e7fa"

describe('StateUpdateController: thread payments', () => {
  const user = mkAddress('0xUUU')
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

describe('StateUpdateController: invalidation handling', () => {
  const user = mkAddress('0xUUU')
  let connext: MockConnextInternal

  const getDateFromMinutesAgo = (minutes: number): Date => {
    const now = new Date()
    now.setMinutes(now.getMinutes() - minutes)
    return now
  }

  parameterizedTests([
    {
      name: 'reject invalidation that has not timed out',
      timeout: 1000,
      blockTimestamp: 500,
      shouldFailWith: /Hub proposed an invalidation for an update that has not yet timed out/
    },

    {
      name: 'handle an invalidation on a state where there is a 0 timeout',
      timeout: 0,
      blockTimestamp: getDateFromMinutesAgo(0),
    },

    {
      name: 'accept a valid invalidation',
      timeout: getDateFromMinutesAgo(15),
      blockTimestamp: getDateFromMinutesAgo(0),
    },

  ], async tc => {
    const mockStore = new MockStore()
    mockStore.setChannel({
      pendingWithdrawalTokenUser: '100',
      pendingDepositTokenUser: '100',
      pendingWithdrawalWeiHub: '20',
      txCountGlobal: 2,
      txCountChain: 2,
      timeout: Math.floor(tc.timeout.valueOf() / 1000),
    })

    mockStore.setLatestPending(2, {
      exchangeRate: '5',
      seller: "user",
      tokensToSell: "0",
      weiToSell: "20",
      targetTokenUser: "0",
      recipient: mkAddress("0x222")
    })

    connext = new MockConnextInternal({
      user,
      store: mockStore.createStore(),
    })

    connext.opts.web3.eth.getBlock = async () => {
      return {
        timestamp: Math.floor(tc.blockTimestamp.valueOf() / 1000),
      } as any
    }

    await connext.start()

    const res = connext.stateUpdateController.handleSyncItem({
      type: 'channel',
      update: {
        reason: 'Invalidation',
        txCount: 3,
        args: {
          previousValidTxCount: 2,
          reason: "CU_INVALID_TIMEOUT",
          withdrawal: {}
        },
        sigHub: '0xsig-hub',
        createdOn: getDateFromMinutesAgo(20),
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
          previousValidTxCount: 2,
          reason: 'CU_INVALID_TIMEOUT',
          withdrawal: connext.store.getState().persistent.latestPending.withdrawal
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
