import {
  assert,
  getThreadState,
  mkAddress,
  mkHash,
  MockConnextInternal,
  MockHub,
  MockStore,
  parameterizedTests,
} from '../testing'
import { ChannelUpdateReason, PaymentArgs, SyncResult } from '../types'

/*
StateUpdateController is used by all the other controllers to handle various
types of state updates that are present in the `runtime.syncResultsFromHub` state.
To do this, it subscribes to the store, and handles the
updates from the hub in the `handleSyncItem` method.
As it is an internal controller with no public API there are no unit tests written.
*/

const logLevel = 1 // 0 = no logs, 5 = all logs

const receiver = '0x22597df3d913c197b4d8f01a3530114847c20832'
const user = '0xc55eddadeeb47fcde0b3b6f25bd47d745ba7e7fa'

describe('StateUpdateController', () => {
  describe('Thread payments', () => {
    let connext: MockConnextInternal

    afterEach(async () => connext.stop())

    parameterizedTests([
      {
        name: 'accept thread payment as sender',
        receiver: false,
      },

      {
        name: 'close thread if received thread payment',
        receiver: true,
      },
    ], async (tc: any): Promise<any> => {
      const mockStore = new MockStore()
      mockStore.setChannel({
        balanceToken: [15, 15],
        balanceWei: [15, 15],
        txCountChain: 2,
        txCountGlobal: 2,
        user: tc.receiver ? receiver : user,
      })

      mockStore.addThread({
        balanceToken: [10, 0],
        balanceWei: [2, 0],
        receiver,
        txCount: 0,
      })

      connext = new MockConnextInternal({
        logLevel,
        store: mockStore.createStore(),
        user,
      })

      await connext.start()

      const res = connext.stateUpdateController.handleSyncItem({
        type: 'thread',
        update: {
          id: 69,
          state: getThreadState('full', {
            balanceToken: [9, 1],
            balanceWei: [2, 0],
            receiver,
          }),
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
          args: {
            balanceTokenReceiver: '1',
            balanceTokenSender: '9',
            receiver,
          },
          reason: 'CloseThread',
          sigHub: false,
          sigUser: true,
        })
      }

    })
  })

  describe('Hub to user payments', () => {
    let connext: MockConnextInternal

    parameterizedTests([
      {
        name: 'should work for hub to user token payments',
        syncResults: [{
          type: 'channel',
          update: {
            args: {
              amountToken: '1',
              amountWei: '0',
              recipient: 'user',
            },
            createdOn: new Date(),
            reason: 'Payment',
            sigHub: mkHash('0x51512'),
            txCount: 1,
          },
        }],
      },
      {
        fails: /There were 1 negative fields detected/,
        name: 'should fail for invalid payments from hub to user',
        syncResults: [{
          type: 'channel',
          update: {
            args: {
              amountToken: '-1',
              amountWei: '0',
              recipient: 'user',
            },
            createdOn: new Date(),
            reason: 'Payment',
            sigHub: mkHash('0x51512'),
            txCount: 1,
          },
        }],
      },
      {
        fails: /sigHub not detected in update/,
        name: 'should fail if the update returned by hub to sync queue is unsigned by hub',
        syncResults: [{
          type: 'channel',
          update: {
            args: {
              amountToken: '1',
              amountWei: '1',
              recipient: 'hub',
            },
            reason: 'Payment',
            sigHub: '',
            txCount: 1,
          },
        }],
      },
      {
        fails: /sigUser not detected in update/,
        name: 'should fail if the update returned by hub is unsigned by user and directed to hub',
        syncResults: [{
          type: 'channel',
          update: {
            args: {
              amountToken: '1',
              amountWei: '1',
              recipient: 'hub',
            },
            reason: 'Payment',
            sigHub: mkHash('0x90283'),
            sigUser: '',
            txCount: 1,
          },
        }],
      },
    ], async ({ name, syncResults, fails }: any): Promise<any> => {
      const mockStore = new MockStore()
      mockStore.setChannel({
        balanceToken: [10, 10],
        balanceWei: [5, 5],
        user,
      })
      mockStore.setSyncResultsFromHub(syncResults as SyncResult[])
      connext = new MockConnextInternal({
        logLevel,
        store: mockStore.createStore(),
        user,
      })

      if (fails) {
        await assert.isRejected(connext.start(), fails)
        return
      }

      await connext.start()

      await new Promise((res: any): any => setTimeout(res, 20))

      for (const res of syncResults) {
        connext.mockHub.assertReceivedUpdate({
          args: res.update.args as PaymentArgs,
          reason: res.update.reason as ChannelUpdateReason,
          sigHub: true,
          sigUser: true,
        })
      }
    })

    afterEach(async () => {
      await connext.stop()
    })
  })

  describe.skip('Invalidation handling', () => {
    const getDateFromMinutesAgo = (minutes: number): Date => {
      const now = new Date()
      now.setMinutes(now.getMinutes() - minutes)
      return now
    }
    const mockStore = new MockStore()

    const connext: MockConnextInternal = new MockConnextInternal({
      logLevel,
      store: mockStore.createStore(),
      user,
    })

    beforeEach(async () => connext.start())
    afterEach(async () => connext.stop())

    parameterizedTests([
      {
        blockTimestamp: getDateFromMinutesAgo(0),
        name: 'accept a valid invalidation',
        timeout: getDateFromMinutesAgo(15),
      },
      {
        blockTimestamp: getDateFromMinutesAgo(0),
        name: 'handle an invalidation on a state where there is a 0 timeout',
        timeout: 0,
      },
      {
        blockTimestamp: 500,
        name: 'reject invalidation that has not timed out',
        shouldFailWith: /Hub proposed an invalidation for an update that has not yet timed out/,
        timeout: 1000,
      },
    ], async (tc: any): Promise<any> => {

      mockStore.setChannel({
        pendingDepositTokenUser: '100',
        pendingWithdrawalTokenUser: '100',
        pendingWithdrawalWeiHub: '20',
        timeout: Math.floor(tc.timeout.valueOf() / 1000),
        txCountChain: 2,
        txCountGlobal: 2,
      })
      mockStore.setLatestPending(2, {
        exchangeRate: '5',
        recipient: mkAddress('0x222'),
        seller: 'user',
        targetTokenUser: '0',
        tokensToSell: '0',
        weiToSell: '20',
      })

      connext.provider.getBlock = async (): Promise<any> => ({
        timestamp: Math.floor(tc.blockTimestamp.valueOf() / 1000),
      })

      const res = connext.stateUpdateController.handleSyncItem({
        type: 'channel',
        update: {
          args: {
            previousValidTxCount: 2,
            reason: 'CU_INVALID_TIMEOUT',
            withdrawal: {},
          },
          createdOn: getDateFromMinutesAgo(20),
          reason: 'Invalidation',
          sigHub: '0xsig-hub',
          txCount: 3,
        },
      })

      if (tc.shouldFailWith) {
        await assert.isRejected(res, tc.shouldFailWith)
        assert.deepEqual(connext.mockHub.receivedUpdateRequests, [])
      } else {
        await res
        connext.mockHub.assertReceivedUpdate({
          args: {
            lastInvalidTxCount: 2,
            previousValidTxCount: 1,
            reason: 'CU_INVALID_TIMEOUT',
          },
          reason: 'Invalidation',
          sigHub: true,
          sigUser: true,
        })
      }

    })

  })
})
