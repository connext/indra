import { MockConnextInternal, MockStore } from '../testing/mocks'
import { assert, mkHash } from '../testing/index'
import { PaymentArgs, } from '@src/types'
// @ts-ignore
global.fetch = require('node-fetch-polyfill');

describe('BuyController: unit tests', () => {
  const user = "0xfb482f8f779fd96a857f1486471524808b97452d"
  let connext: MockConnextInternal
  const mockStore = new MockStore()

  beforeEach(async () => {
    mockStore.setChannel({
      user,
      balanceWei: [1, 1],
      balanceToken: [10, 10],
    })
    connext = new MockConnextInternal({ user, store: mockStore.createStore() })
  })

  it('should work for user to hub payments', async () => {
    await connext.start()
    await connext.buyController.buy({
      meta: {},
      payments: [
        {
          amount: { amountToken: '1', amountWei: '0' },
          type: 'PT_CHANNEL',
          meta: {},
          recipient: '$$HUB$$',
        },
      ],
    })

    await new Promise(res => setTimeout(res, 20))
    connext.mockHub.assertReceivedUpdate({
      reason: 'Payment',
      args: {
        amountToken: '1',
        amountWei: '0',
        recipient: 'hub',
      } as PaymentArgs,
      sigUser: true,
      sigHub: false,
    })
  })

  it('should work for hub to user payments', async () => {
    mockStore.setSyncResultsFromHub([{
      type: "channel",
      update: {
        reason: "Payment",
        args: {
          recipient: "user",
          amountToken: '1',
          amountWei: '1',
        } as PaymentArgs,
        txCount: 1,
        sigHub: mkHash('0x51512'),
      },
    }])
    connext = new MockConnextInternal({ user, store: mockStore.createStore() })

    await connext.start()

    await new Promise(res => setTimeout(res, 20))
    connext.mockHub.assertReceivedUpdate({
      reason: 'Payment',
      args: {
        amountToken: '1',
        amountWei: '1',
        recipient: 'user',
      } as PaymentArgs,
      sigUser: true,
      sigHub: true,
    })
  })

  it('should fail if the user sends a thread payment', async () => {
    await connext.start()
    // single thread payments
    await assert.isRejected(connext.buyController.buy({
      meta: {},
      payments: [
        {
          amount: { amountToken: '1', amountWei: '0' },
          type: 'PT_THREAD',
          meta: {},
          recipient: '$$HUB$$',
        },
      ],
    }),
      /REB-36/
    )

    // embedded thread payments
    await assert.isRejected(connext.buyController.buy({
      meta: {},
      payments: [
        {
          amount: { amountToken: '1', amountWei: '0' },
          type: 'PT_CHANNEL',
          meta: {},
          recipient: '$$HUB$$',
        },
        {
          amount: { amountToken: '1', amountWei: '0' },
          type: 'PT_THREAD',
          meta: {},
          recipient: '$$HUB$$',
        },
      ],
    }),
      /REB-36/
    )
  })

  it('should fail if it cannot generate a valid state', async () => {
    await connext.start()
    // single thread payments
    await assert.isRejected(connext.buyController.buy({
      meta: {},
      payments: [
        {
          amount: { amountToken: '1', amountWei: '50' },
          type: 'PT_CHANNEL',
          meta: {},
          recipient: '$$HUB$$',
        },
      ],
    }),
      /User does not have sufficient Wei balance/
    )
  })

  it('should fail if the hub returns a thread update to the sync queue', async () => {
    mockStore.setSyncResultsFromHub([{
      type: "thread",
      update: {} as any
    }])
    connext = new MockConnextInternal({ user, store: mockStore.createStore() })

    await assert.isRejected(connext.start(), /REB-36/)
  })

  it('should fail if the update returned by hub to sync queue is unsigned by hub', async () => {
    mockStore.setSyncResultsFromHub([{
      type: "channel",
      update: {
        reason: "Payment",
        args: {
          recipient: "hub",
          amountToken: '1',
          amountWei: '1',
        } as PaymentArgs,
        txCount: 1,
        sigHub: '',
      },
    }])
    connext = new MockConnextInternal({ user, store: mockStore.createStore() })

    await assert.isRejected(connext.start(), /sigHub not detected in update/)
  })

  it('should fail if the update returned by hub to sync queue is unsigned by user and directed to hub', async () => {
    mockStore.setSyncResultsFromHub([{
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
    }])
    connext = new MockConnextInternal({ user, store: mockStore.createStore() })

    await assert.isRejected(connext.start(), /sigUser not detected in update/)
  })

  afterEach(async () => {
    await connext.stop()
  })
})