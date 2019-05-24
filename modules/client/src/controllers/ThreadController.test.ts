import { toBN } from '../lib/bn'
import { assert, mkAddress } from '../testing'
import { MockConnextInternal, MockStore } from '../testing/mocks'
import { PaymentArgs, ThreadState } from '../types'

describe('ThreadController: unit tests', () => {
    let connext: MockConnextInternal
    let mockStore: MockStore
    const sender = '0xfb482f8f779fd96a857f1486471524808b97452d'
    const receiver1 = '0x23a1e8118EA985bBDcb7c40DE227a9880a79cf7F'
    const receiver2 = '0x17b105bcb3f06b3098de6eed0497a3e36aa72471'

    describe('OpenThread', () => {
        beforeEach(async () => {
          mockStore = new MockStore()
          mockStore.setChannel({
            balanceToken: [10, 10],
            balanceWei: [2, 2],
            user: sender,
          })
          connext = new MockConnextInternal({ user: sender, store: mockStore.createStore()})
        })

        it('should work for first thread', async () => {
          await connext.start()
          // generate openThread state and send to hub
          await connext.threadsController.openThread(receiver1, {
              amountToken: '2',
              amountWei: '1',
          })
          await new Promise((res: any): any => setTimeout(res, 20))
          // assert that the received update is correct
          connext.mockHub.assertReceivedUpdate({
            args: {
              balanceTokenReceiver: '0',
              balanceTokenSender: '2',
              balanceWeiReceiver: '0',
              balanceWeiSender: '1',
              receiver: receiver1,
              sender,
            },
            reason: 'OpenThread',
            sigHub: false,
            sigUser: true,
          })
        })

        it('should work with new sender/receiver', async() => {
          await connext.start()
          // generate openThread state and send to hub
          await connext.threadsController.openThread(receiver1, {
            amountToken: '2',
            amountWei: '1',
          })

          await new Promise((res: any): any => setTimeout(res, 20))

          // assert that the received update is correct
          connext.mockHub.assertReceivedUpdate({
            args: {
              balanceTokenReceiver: '0',
              balanceTokenSender: '2',
              balanceWeiReceiver: '0',
              balanceWeiSender: '1',
              receiver: receiver1,
              sender,
            },
            reason: 'OpenThread',
            sigHub: false,
            sigUser: true,
          })

          // open a second thread with the same sender, new reciever
          await connext.threadsController.openThread(receiver2, {
            amountToken: '1',
            amountWei: '0',
          })

          await new Promise((res: any): any => setTimeout(res, 20))

          // assert that the received update is correct
          connext.mockHub.assertReceivedUpdate({
            args: {
              balanceTokenReceiver: '0',
              balanceTokenSender: '1',
              balanceWeiReceiver: '0',
              balanceWeiSender: '0',
              receiver: receiver2,
              sender,
            },
            reason: 'OpenThread',
            sigHub: false,
            sigUser: true,
          })

        })

        it('should fail if the threadHistory is inaccurate', async() => {
          // add an extra thread history item there
          mockStore.setThreadHistory([
            { sender, receiver: receiver1, threadId: 2 },
            { sender, receiver: receiver1, threadId: 0 },
          ])

          connext = new MockConnextInternal({ user: sender, store: mockStore.createStore()})

          await connext.start()

          await assert.isRejected(connext.threadsController.openThread(receiver1, {
            amountToken: '1',
            amountWei: '0',
          }), /The thread history is inaccurate/)

        })

        afterEach(async () => {
          await connext.stop()
        })
    })

    describe('CloseThread', () => {
      const receiver = receiver1
      const threadId = 1
      beforeEach(() => {
        mockStore = new MockStore()
        mockStore.setChannel({
          balanceToken: [10, 10],
          balanceWei: [5, 5],
          threadCount: 0,
          user: sender,
        })
        mockStore.addThread({
          balanceTokenSender: '5',
          balanceWeiSender: '3',
          receiver,
          sender,
          threadId,
        })
        mockStore.updateThread(
          {sender, receiver, threadId},
          {
            amountToken: toBN(2),
            amountWei: toBN(1),
          },
        )
        connext = new MockConnextInternal({ user: sender, store: mockStore.createStore()})
      })

      it('closing a thread should work', async () => {
        await connext.start()
        // generate closeThread state and send to hub
        await connext.threadsController.closeThread({
          receiver: receiver1,
          sender,
          threadId: 1,
        })
        await new Promise((res: any): any => setTimeout(res, 20))
        // assert that the received update is correct
        connext.mockHub.assertReceivedUpdate({
          args: {
            balanceTokenReceiver: '2',
            balanceTokenSender: '3',
            balanceWeiReceiver: '1',
            balanceWeiSender: '2',
            receiver: receiver1,
            sender,
          },
          reason: 'CloseThread',
          sigHub: false,
          sigUser: true,
        })
      })

      it('should fail if there is no active thread matching the one you wish to close', async() => {
        await connext.start()

        await assert.isRejected(connext.threadsController.closeThread(
          { sender, receiver: receiver2, threadId: 1 },
        ), /No thread found./)
      })

      // NOTE: this likely wont happen, but its good to have it in place anyways
      it(
        'should fail if there are multiple active threads matching the one you wish to close',
        async() => {
          // update the store to be incorrect
          mockStore = new MockStore()
          mockStore.setChannel({
            balanceToken: [10, 10],
            balanceWei: [5, 5],
            threadCount: 0,
            user: sender,
          })
          mockStore.addThread({
            balanceTokenSender: '5',
            balanceWeiSender: '3',
            receiver,
            sender,
            threadId,
          })
          mockStore.addThread({
            balanceTokenSender: '5',
            balanceWeiSender: '3',
            receiver,
            sender,
            threadId,
          })

          connext = new MockConnextInternal({ user: sender, store: mockStore.createStore()})

          await connext.start()

          await assert.isRejected(connext.threadsController.closeThread(
            { sender, receiver: receiver1, threadId: 1 },
          ), /Multiple threads found/)
        },
      )

      afterEach(async () => {
        await connext.stop()
      })
    })
})
