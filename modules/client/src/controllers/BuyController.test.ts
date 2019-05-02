import { assert, mkAddress, mkHash } from '../testing';
import { MockConnextInternal, MockStore, MockHub } from '../testing/mocks'
import { PaymentArgs, PurchasePaymentType, PurchasePaymentRequest } from '../types';
import { emptyAddress } from '../Utils';
// @ts-ignore
global.fetch = require('node-fetch-polyfill');

describe("BuyController: assignPaymentTypes", () => {
  let connext: MockConnextInternal

  const user = mkAddress('0x7fab')
  const receiver = mkAddress('0x22c')
  const mockStore: MockStore = new MockStore()

  beforeEach(async () => {
    mockStore.setHubAddress()
    const store = mockStore.createStore()
    connext = new MockConnextInternal({ 
      user, 
      store,
    })
    await connext.start()
  })

  it("should retain a type if its provided", async () => {
    const payment: any = {
      recipient: receiver,
      amount: {
        amountToken: '15',
        amountWei: '0',
      },
      type: "PT_LINK",
    }
    const ans = await connext.buyController.assignPaymentType(payment)
    assert.containSubset(ans, {
      ...payment,
      type: "PT_LINK"
    })
  })

  it("should assign a PT_LINK payment if there is a secret provided in the meta", async () => {
    const payment: PurchasePaymentRequest = {
      recipient: receiver,
      amount: {
        amountToken: '15',
        amountWei: '0',
      },
      meta: {
        secret: connext.generateSecret()
      },
    }
    const ans = await connext.buyController.assignPaymentType(payment)
    assert.containSubset(ans, {
      ...payment,
      type: "PT_LINK"
    })
  })

  it("should assign a PT_CUSTODIAL if the amount is greater than the amount the hub will collateralize", async () => {
    const payment: PurchasePaymentRequest = {
      recipient: receiver,
      amount: {
        amountToken: '150',
        amountWei: '0',
      },
      meta: {},
    }
    const ans = await connext.buyController.assignPaymentType(payment)
    assert.containSubset(ans, {
      ...payment,
      type: "PT_CUSTODIAL"
    })
  })

  it("should assign a PT_CHANNEL if the payment is to the hub", async () => {
    const payment: PurchasePaymentRequest = {
      recipient: mkAddress("0xhhh"),
      amount: {
        amountToken: '10',
        amountWei: '0',
      },
      meta: {},
    }
    const ans = await connext.buyController.assignPaymentType(payment)
    assert.containSubset(ans, {
      ...payment,
      type: "PT_CHANNEL"
    })
  })

  it("should assign a PT_OPTIMISTIC if the type is not provided, and the hub can handle forwarding the payment (below max)", async () => {
    const payment: PurchasePaymentRequest = {
      recipient: receiver,
      amount: {
        amountToken: '14',
        amountWei: '0',
      },
      meta: {},
    }
    const ans = await connext.buyController.assignPaymentType(payment)
    assert.containSubset(ans, {
      ...payment,
      type: "PT_OPTIMISTIC"
    })
  })
})

describe('BuyController: unit tests', () => {
  const user = mkAddress('0x7fab')
  const receiver = mkAddress('0x22c')
  const receiver2 = mkAddress('0x22c44')
  const hubAddress = mkAddress('0xfc5')
  let connext: MockConnextInternal
  let mockStore: MockStore

  beforeEach(async () => {
    mockStore = new MockStore()
    mockStore.setChannel({
      user,
      balanceWei: [5, 5],
      balanceToken: [10, 10],
    })
    const mockHub = new MockHub()
    connext = new MockConnextInternal({ user, store: mockStore.createStore(), hub: mockHub })
  })

  // channel and custodial payments
  it('should work for `PT_CHANNEL` user to hub token payments', async () => {
    await connext.start()
    await connext.buyController.buy({
      meta: {},
      payments: [
        {
          amount: { amountToken: '1' },
          type: 'PT_CHANNEL',
          meta: {},
          recipient: hubAddress,
        },
      ],
    })

    await new Promise(res => setTimeout(res, 20))

    // hub should receive the user-signed update
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

  it('should work for PT_CUSTODIAL user to hub token payments', async () => {
    await connext.start()
    await connext.buyController.buy({
      meta: {},
      payments: [
        {
          amount: { amountToken: '1', },
          type: 'PT_CUSTODIAL' as PurchasePaymentType,
          meta: {},
          recipient: receiver,
        },
      ],
    })

    await new Promise(res => setTimeout(res, 20))

    // hub should receive the user-signed update
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

  it('should fail for invalid `PT_CHANNEL` user to hub payments', async () => {
    await connext.start()
    await assert.isRejected(connext.buyController.buy({
      meta: {},
      payments: [
        {
          amount: { amountToken: '1', amountWei: '10' },
          type: 'PT_CHANNEL',
          meta: {},
          recipient: receiver,
        },
      ],
    }), /User does not have sufficient Wei balance for a transfer of value/)
  })

  it('should fail for invalid `PT_CUSTODIAL` user to hub payments', async () => {
    await connext.start()
    await assert.isRejected(connext.buyController.buy({
      meta: {},
      payments: [
        {
          amount: { amountToken: '1', amountWei: '10' },
          type: 'PT_CUSTODIAL',
          meta: {},
          recipient: receiver,
        },
      ],
    }), /User does not have sufficient Wei balance for a transfer of value/)
  })

  // testing linked payments
  it('should work for `PT_LINK` user token payments', async () => {
    await connext.start()
    await connext.buyController.buy({
      meta: {},
      payments: [
        {
          amount: { amountToken: '1', },
          type: 'PT_LINK' as PurchasePaymentType,
          meta: { secret: connext.generateSecret() },
          recipient: emptyAddress,
        },
      ],
    })

    await new Promise(res => setTimeout(res, 20))

    // hub should receive the user-signed update
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

  it('should fail for `PT_LINK` user token payments if secret is not provided', async () => {
    await connext.start()
    await assert.isRejected(connext.buyController.buy({
      meta: {},
      payments: [
        {
          amount: { amountToken: '1', },
          type: 'PT_LINK' as PurchasePaymentType,
          meta: {},
          recipient: emptyAddress,
        },
      ],
    }), /Secret is not present/)
  })

  it('should fail for `PT_LINK` user token payments if secret is not provided', async () => {
    await connext.start()
    await assert.isRejected(connext.buyController.buy({
      meta: {},
      payments: [
        {
          amount: { amountToken: '1', },
          type: 'PT_LINK' as PurchasePaymentType,
          meta: { secret: 'secret' },
          recipient: emptyAddress,
        },
      ],
    }), /Secret is not hex string/)
  })

  // testing sync response from hub
  it('should work for hub to user token payments', async () => {
    mockStore.setSyncResultsFromHub([{
      type: "channel",
      update: {
        reason: "Payment",
        args: {
          recipient: "user",
          amountToken: '1',
          amountWei: '0',
        } as PaymentArgs,
        txCount: 1,
        sigHub: mkHash('0x51512'),
        createdOn: new Date()
      },
    }])
    connext = new MockConnextInternal({ user, store: mockStore.createStore() })

    await connext.start()

    await new Promise(res => setTimeout(res, 20))
    connext.mockHub.assertReceivedUpdate({
      reason: 'Payment',
      args: {
        amountToken: '1',
        amountWei: '0',
        recipient: 'user',
      } as PaymentArgs,
      sigUser: true,
      sigHub: true,
    })
  })

  it('should fail for invalid payments from hub to user', async () => {
    mockStore.setSyncResultsFromHub([{
      type: "channel",
      update: {
        reason: "Payment",
        args: {
          recipient: "user",
          amountToken: '-1',
          amountWei: '0',
        } as PaymentArgs,
        txCount: 1,
        sigHub: mkHash('0x51512'),
        createdOn: new Date()
      },
    }])
    connext = new MockConnextInternal({ user, store: mockStore.createStore() })

    await assert.isRejected(connext.start(), /There were 1 negative fields detected/)
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


  it('should work for a single thread payment to a receiver', async () => {
    await connext.start()
    await connext.buyController.buy({
      meta: {},
      payments: [
        {
          amount: { amountToken: '1', },
          type: 'PT_THREAD' as PurchasePaymentType,
          meta: {},
          recipient: receiver,
        },
      ],
    })

    // has thread update
    const syncResultsFromHub = connext.store.getState().runtime.syncResultsFromHub

    assert.containSubset(syncResultsFromHub[0], {
      type: "thread",
      update: {
        state: {
          threadId: 1,
          balanceWeiSender: '0',
          balanceWeiReceiver: '0',
          balanceTokenSender: '0',
          balanceTokenReceiver: '1',
          txCount: 1,
        }
      }
    })

    await new Promise(res => setTimeout(res, 20))
    // should open thread
    connext.mockHub.assertReceivedUpdate({
      reason: 'OpenThread',
      args: {
        balanceTokenSender: '1',
        balanceWeiSender: '0',
        balanceTokenReceiver: '0',
        balanceWeiReceiver: '0',
      },
      sigUser: true,
      sigHub: false,
    })
  })

  it('should work for a thread payment to a different receiver', async () => {
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
        {
          amount: { amountToken: '0', amountWei: '1' },
          type: 'PT_THREAD',
          meta: {},
          recipient: receiver2,
        },
      ],
    })

    // has thread update
    const syncResultsFromHub = connext.store.getState().runtime.syncResultsFromHub

    assert.containSubset(syncResultsFromHub, [{
      type: "thread",
      update: {
        state: {
          threadId: 1,
          balanceWeiSender: '0',
          balanceWeiReceiver: '0',
          balanceTokenSender: '0',
          balanceTokenReceiver: '1',
          receiver,
          txCount: 1,
        }
      }
    },
    {
      type: "thread",
      update: {
        state: {
          threadId: 1,
          balanceWeiSender: '0',
          balanceWeiReceiver: '1',
          balanceTokenSender: '0',
          balanceTokenReceiver: '0',
          receiver: receiver2,
          txCount: 1,
        }
      }
    },
  ])

    await new Promise(res => setTimeout(res, 20))
    // should open threads
    connext.mockHub.assertReceivedUpdate({
      reason: 'OpenThread',
      args: {
        balanceTokenSender: '1',
        balanceWeiSender: '0',
        balanceTokenReceiver: '0',
        balanceWeiReceiver: '0',
      },
      sigUser: true,
      sigHub: false,
    })
    connext.mockHub.assertReceivedUpdate({
      reason: 'OpenThread',
      args: {
        balanceTokenSender: '0',
        balanceWeiSender: '1',
        balanceTokenReceiver: '0',
        balanceWeiReceiver: '0',
      },
      sigUser: true,
      sigHub: false,
    })
  })


  it('should work for mixed payments', async () => {
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
        {
          amount: { amountToken: '1', amountWei: '0' },
          type: 'PT_LINK',
          meta: { secret: connext.generateSecret() },
          recipient: emptyAddress,
        },
      ],
    })

    // has thread update
    const syncResultsFromHub = connext.store.getState().runtime.syncResultsFromHub

    assert.containSubset(syncResultsFromHub[0], {
      type: "thread",
      update: {
        state: {
          threadId: 1,
          balanceWeiSender: '0',
          balanceWeiReceiver: '0',
          balanceTokenSender: '0',
          balanceTokenReceiver: '1',
          txCount: 1,
        }
      }
    })

    await new Promise(res => setTimeout(res, 20))
    // should open thread
    connext.mockHub.assertReceivedUpdate({
      reason: 'OpenThread',
      args: {
        balanceTokenSender: '1',
        balanceWeiSender: '0',
        balanceTokenReceiver: '0',
        balanceWeiReceiver: '0',
      },
      sigUser: true,
      sigHub: false,
    })
    // should make linked payment
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

  afterEach(async () => {
    await connext.stop()
  })
})