import { MockConnextInternal, MockStore } from '../testing/mocks'
import { assert, mkHash } from '../testing/index'
import { PaymentArgs, } from '@src/types'
// @ts-ignore
global.fetch = require('node-fetch-polyfill');

describe('BuyController: unit tests', () => {
  const user = "0xfb482f8f779fd96a857f1486471524808b97452d"
  const receiver = "0x23a1e8118EA985bBDcb7c40DE227a9880a79cf7F"
  let connext: MockConnextInternal
  const mockStore = new MockStore()

  beforeEach(async () => {
    mockStore.setChannel({
      user,
      balanceWei: [50000000000000000, 50000000000000000],
      balanceToken: [100000000000000000, 100000000000000000],
    })
    connext = new MockConnextInternal({ user, store: mockStore.createStore() })
  })

  // it('should work for user to hub payments', async () => {
  //   await connext.start()
  //   await connext.buyController.buy({
  //     meta: {},
  //     payments: [
  //       {
  //         amount: { amountToken: '1', amountWei: '0' },
  //         type: 'PT_CHANNEL',
  //         meta: {},
  //         recipient: '$$HUB$$',
  //       },
  //     ],
  //   })

  //   await new Promise(res => setTimeout(res, 20))
  //   connext.mockHub.assertReceivedUpdate({
  //     reason: 'Payment',
  //     args: {
  //       amountToken: '1',
  //       amountWei: '0',
  //       recipient: 'hub',
  //     } as PaymentArgs,
  //     sigUser: true,
  //     sigHub: false,
  //   })
  // })

  // it('should work for hub to user payments', async () => {
  //   mockStore.setSyncResultsFromHub([{
  //     type: "channel",
  //     update: {
  //       reason: "Payment",
  //       args: {
  //         recipient: "user",
  //         amountToken: '1',
  //         amountWei: '1',
  //       } as PaymentArgs,
  //       txCount: 1,
  //       sigHub: mkHash('0x51512'),
  //     },
  //   }])
  //   connext = new MockConnextInternal({ user, store: mockStore.createStore() })

  //   await connext.start()

  //   await new Promise(res => setTimeout(res, 20))
  //   connext.mockHub.assertReceivedUpdate({
  //     reason: 'Payment',
  //     args: {
  //       amountToken: '1',
  //       amountWei: '1',
  //       recipient: 'user',
  //     } as PaymentArgs,
  //     sigUser: true,
  //     sigHub: true,
  //   })
  // })

  // it('should fail if the update returned by hub to sync queue is unsigned by hub', async () => {
  //   mockStore.setSyncResultsFromHub([{
  //     type: "channel",
  //     update: {
  //       reason: "Payment",
  //       args: {
  //         recipient: "hub",
  //         amountToken: '1',
  //         amountWei: '1',
  //       } as PaymentArgs,
  //       txCount: 1,
  //       sigHub: '',
  //     },
  //   }])
  //   connext = new MockConnextInternal({ user, store: mockStore.createStore() })

  //   await assert.isRejected(connext.start(), /sigHub not detected in update/)
  // })

  // it('should fail if the update returned by hub to sync queue is unsigned by user and directed to hub', async () => {
  //   mockStore.setSyncResultsFromHub([{
  //     type: "channel",
  //     update: {
  //       reason: "Payment",
  //       args: {
  //         recipient: "hub",
  //         amountToken: '1',
  //         amountWei: '1',
  //       } as PaymentArgs,
  //       txCount: 1,
  //       sigHub: mkHash('0x90283'),
  //       sigUser: '',
  //     },
  //   }])
  //   connext = new MockConnextInternal({ user, store: mockStore.createStore() })

  //   await assert.isRejected(connext.start(), /sigUser not detected in update/)
  // })

  // Buy PT_THREAD Passing tests
  // 1. Single thread payment when no thread exists
  // 2. Single thread payment where thread exists and can handle payment
  // 3. Single thread payment where thread exists and can't handle payment
  // 4. Single thread payment above the threshold
  // 5. Multiple thread payments within a thread that can handle hem

  // Buy PT_THREAD Failing tests
  // 1. Multiple active threads between sender and receiver

  it('should work for a single thread payment to a receiver', async () => {
    console.log("HEREEE----------------------------------")
    await connext.start()
    console.log("STARTED")
    // await connext.buyController.buy({
    //   meta: {},
    //   payments: [
    //     {
    //       amount: { amountToken: '1', amountWei: '0' },
    //       type: 'PT_THREAD',
    //       meta: {},
    //       recipient: receiver,
    //     },
    //   ],
    // })
  })

  it('should work for a more thread payments to the same receiver', async () => {
  })

  it('should work for a single payments to a different receiver', async () => {
  })

  afterEach(async () => {
    await connext.stop()
  })
})