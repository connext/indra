import { ethers as eth } from 'ethers'

import {
  assert,
  assertThreadStateEqual,
  mkAddress,
  mkHash,
  parameterizedTests,
} from '../testing'
import { MockConnextInternal, MockHub, MockStore } from '../testing/mocks'
import {
  Payment,
  PaymentArgs,
  PurchasePayment,
  PurchasePaymentRequest,
  PurchasePaymentType,
  SyncResult,
} from '../types'

// @ts-ignore
global.fetch = require('node-fetch-polyfill')

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
    const payment = {
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
    const payment = {
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
    const payment = {
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
    const payment = {
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
  let secret: string

  beforeEach(async () => {
    mockStore = new MockStore()
    mockStore.setChannel({
      user,
      balanceWei: [5, 5],
      balanceToken: [10, 10],
    })
    const mockHub = new MockHub()
    connext = new MockConnextInternal({ user, store: mockStore.createStore(), hub: mockHub })
    secret = connext.generateSecret()
  })

  parameterizedTests([
    {
      name: 'should work for PT_CHANNEL user to hub token payments',
      payments: [{
        amount: { amountToken: '1', },
        type: 'PT_CHANNEL',
        recipient: hubAddress,
      }],
      meta: null
    },
    {
      name: 'should work for PT_CHANNEL user to hub token payments without type',
      payments: [{
        amount: { amountToken: '1', },
        recipient: hubAddress,
      }],
      meta: null
    },
    {
      name: 'should work for PT_CUSTODIAL user to hub token payments',
      payments: [{
        amount: { amountToken: '1', },
        type: 'PT_CUSTODIAL',
        recipient: receiver,
      }]
    },
    {
      name: 'should fail for invalid PT_CHANNEL user to hub payments',
      payments: [{
        amount: { amountToken: '1', amountWei: '10' },
        type: 'PT_CHANNEL',
        recipient: receiver,
      }],
      fails: /User does not have sufficient Wei balance for a transfer of value/
    },
    {
      name: 'should fail for invalid PT_CUSTODIAL user to hub payments',
      payments: [{
        amount: { amountToken: '1', amountWei: '10' },
        type: 'PT_CUSTODIAL',
        meta: {},
        recipient: receiver,
      }],
      fails: /User does not have sufficient Wei balance for a transfer of value/
    },
    {
      name: "should work for PT_LINK user token payments",
      payments: [{
        amount: { amountToken: '1', },
        type: 'PT_LINK',
        meta: { secret: mkHash("0xff"), },
        recipient: eth.constants.AddressZero,
      }],
    },
    {
      name: "should work for PT_LINK user token payments without type",
      payments: [{
        amount: { amountToken: '1', },
        meta: { secret: mkHash("0xff"), },
        recipient: eth.constants.AddressZero,
      }],
    },
    {
      name: "should fail for PT_LINK user token payments if secret is not provided",
      payments: [{
        amount: { amountToken: '1', },
        type: 'PT_LINK' as PurchasePaymentType,
        recipient: eth.constants.AddressZero,
      }],
      fails: /Secret is not present/,
    },
    {
      name: 'should fail for PT_LINK user token payments if secret is not provided',
      payments: [{
        amount: { amountToken: '1', },
        type: 'PT_LINK' as PurchasePaymentType,
        meta: { secret: 'secret' },
        recipient: eth.constants.AddressZero,
      }],
      fails: /Secret is not hex string/,
    },
    {
      name: "should work for a single thread payment to a receiver",
      payments: [{
        amount: { amountToken: '1', },
        type: 'PT_THREAD' as PurchasePaymentType,
        recipient: receiver,
      }]
    },
    {
      name: "should work for a thread payment to a different receiver",
      payments: [
        {
          amount: { amountToken: '1', amountWei: '0' },
          type: 'PT_THREAD',
          recipient: receiver,
        },
        {
          amount: { amountToken: '0', amountWei: '1' },
          type: 'PT_THREAD',
          recipient: receiver2,
        },
      ]
    },
    {
      name: "should work for mixed payments",
      payments: [
        {
          amount: { amountToken: '1', amountWei: '0' },
          type: 'PT_THREAD',
          recipient: receiver,
        },
        {
          amount: { amountToken: '1', amountWei: '0' },
          type: 'PT_LINK',
          meta: { secret: mkHash("0xff") },
          recipient: eth.constants.AddressZero,
        },
      ],
    }
  ], ({ name, payments, fails, meta }) => {
    it(name, async () => {
      await connext.start()

      if (fails) {
        await assert.isRejected(
          connext.buyController.buy({
            meta: meta || {},
            payments: payments as any,
          }),
          fails
        )
        return
      }

      await connext.buyController.buy({
        meta: meta || {},
        payments: payments as any,
      })

      await new Promise(res => setTimeout(res, 20))

      // hub should receive the user-signed update
      for (const p of payments) {
        // is hub to user payment?
        const isUser = p.recipient == connext.opts.user!
        // is thread payment?
        if ((p as PurchasePayment).type) {
          // check that user has sent thread update
          const syncRes = connext.store.getState().runtime.syncResultsFromHub
          for (const res of syncRes) {
            assert.containSubset(res, {
              type: "thread",
              update: {
                state: {
                  balanceWeiSender: '0',
                  balanceWeiReceiver: (p.amount as Payment).amountWei || '0',
                  balanceTokenSender: '0',
                  balanceTokenReceiver: (p.amount as Payment).amountToken || '0',
                  txCount: 1,
                  receiver: p.recipient
                }
              }
            })
          }
          // check that there is an open thread
          await new Promise(r => setTimeout(r, 20))

          connext.mockHub.assertReceivedUpdate({
            reason: 'OpenThread',
            args: {
              balanceWeiReceiver: '0',
              balanceWeiSender: (p.amount as Payment).amountWei || '0',
              balanceTokenReceiver: '0',
              balanceTokenSender: (p.amount as Payment).amountToken || '0',
            },
            sigUser: true,
            sigHub: false,
          })

          continue
        }

        connext.mockHub.assertReceivedUpdate({
          reason: 'Payment',
          args: {
            amountToken: (p.amount as Payment).amountToken || '0',
            amountWei: (p.amount as Payment).amountWei || '0',
            recipient: isUser ? 'user' : 'hub',
          } as PaymentArgs,
          sigUser: true,
          sigHub: isUser,
        })
      }
    })
  })

  afterEach(async () => {
    await connext.stop()
  })
})
