import { MockConnextInternal, MockStore } from '../testing/mocks'
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
      balanceWei: [5, 5],
      balanceToken: [10, 10],
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
  //         recipient: process.env.HUB_ADDRESS,
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

/*
  it('should work for a single thread payment to a receiver', async () => {
    await connext.start()
    await connext.buyController.buy({
      meta: {},
      payments: [
        {
          amount: { amountToken: '1', amountWei: '0' },
          type: 'PT_THREAD',
          meta: {},
          recipient: receiver,
        },
      ],
    })
  })
*/

  it('should work for a more threads to the same receiver', async () => {
  })

  it('should work for a thread payment to a different receiver', async () => {
  })

  afterEach(async () => {
    await connext.stop()
  })
})
