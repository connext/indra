import { MockConnextInternal, MockStore } from '../testing/mocks'
import { mkAddress } from '../testing';
import { PaymentArgs, ThreadState } from '@src/types';

describe('ThreadController: unit tests', () => {
    let connext: MockConnextInternal
    const mockStore = new MockStore()
    const sender = "0xfb482f8f779fd96a857f1486471524808b97452d"
    const receiver1 = "0x23a1e8118EA985bBDcb7c40DE227a9880a79cf7F"
    
    describe('OpenThread', () => {
        beforeEach(async () => {
            mockStore.setChannel({
              user: sender,
              balanceWei: [1, 1],
              balanceToken: [10, 10],
              contractAddress: mkAddress('0xccc')
            })
            connext = new MockConnextInternal({ user: sender, store: mockStore.createStore()})
        })

        it('should work for first thread', async () => {
            await connext.start()
            // generate openThread state and send to hub
            await connext.threadsController.openThread(receiver1, {
                amountToken: '2',
                amountWei: '1'
            })
            await new Promise(res => setTimeout(res, 20))
            // assert that the received update is correct
            connext.mockHub.assertReceivedUpdate({
              reason: 'OpenThread',
              args: {
                balanceTokenSender: '2',
                balanceWeiSender: '1',
                balanceTokenReceiver: '0',
                balanceWeiReceiver: '0',
                sender,
                receiver: receiver1,
              } as Partial<ThreadState>,
              sigUser: true,
              sigHub: false,
            })
        })

        it('should work for subsequent threads', async() => {

        })

        it('should work with new sender/receiver', async() => {

        })
        
        it('should fail if the sender/receiver already have an active thread between them', async() => {

        })

        it('should fail if the threadHistory is inaccurate (how do we check this?)', async() => {

        })
    })

    describe('CloseThread', () => {
        it('should work', async () => {

        }) 

        it('should fail if the thread with that ID was already closed', async() => {

        })
    })
})