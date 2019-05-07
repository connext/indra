import { ethers as eth } from 'ethers'

import {
  assert,
  mkAddress,
  mkHash,
  parameterizedTests,
} from '../testing'
import { MockConnextInternal, MockHub, MockStore } from '../testing/mocks'
import {
  Payment,
  PaymentArgs,
  PurchasePayment,
  PurchasePaymentType,
  PartialPurchasePaymentRequest,
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

  parameterizedTests([
    {
      name: "should retain a type if its provided",
      payment: {
        recipient: receiver,
        amountToken: '15',
        type: "PT_LINK",
      } as PartialPurchasePaymentRequest,
      expected: {
        amount: {
          amountWei: '0',
        },
      },
    },

    {
      name: "should assign a PT_LINK payment if there is a secret provided in the meta",
      payment: {
        recipient: receiver,
        amountToken: '15',
        meta: {
          secret: mkHash("0xss")
        },
      } as PartialPurchasePaymentRequest,
      expected: {
        amount: {
          amountWei: '0',
        },
        type: "PT_LINK",
      },
    },

    {
      name: "should assign a PT_CUSTODIAL if the amount is greater than the amount the hub will collateralize",
      payment: {
        recipient: receiver,
        amountToken: '150',
      } as PartialPurchasePaymentRequest,
      expected: {
        amount: {
          amountWei: '0',
        },
        type: "PT_CUSTODIAL",
        meta: {}
      },
    },

    {
      name: "should assign a PT_CHANNEL if the payment is to the hub",
      payment: {
        recipient: mkAddress("0xhhh"),
        amountToken: '10',
      } as PartialPurchasePaymentRequest,
      expected: {
        amount: {
          amountWei: '0',
        },
        type: "PT_CHANNEL",
        meta: {}
      },
    },

    {
      name: "should assign a PT_OPTIMISTIC if the type is not provided, and the hub can handle forwarding the payment (below max)",
      payment: {
        recipient: receiver,
        amountToken: '10',
      } as PartialPurchasePaymentRequest,
      expected: {
        amount: {
          amountWei: '0',
        },
        type: "PT_OPTIMISTIC",
        meta: {}
      },
    },

  ], async (tc) => {
    const ans = await connext.buyController.assignPaymentType(tc.payment)
    const { amountToken, amountWei, ...res } = tc.payment
    assert.containSubset(ans, {
      ...res,
      amount: {
        amountToken,
        amountWei,
      },
      ...tc.expected,
    })
  })
})

describe('BuyController: unit tests', () => {
  let user
  const receiver = mkAddress('0x22c')
  const receiver2 = mkAddress('0x22c44')
  const hubAddress = mkAddress('0xHHH')
  let connext: MockConnextInternal
  let mockStore: MockStore
  let secret: string

  beforeEach(async () => {
    mockStore = new MockStore()
    mockStore.setChannel({
      balanceWei: [5, 5],
      balanceToken: [10, 10],
    })
    connext = new MockConnextInternal({ 
      store: mockStore.createStore(), 
    })
    user = connext.wallet.address
    secret = connext.generateSecret()
  })

  parameterizedTests([
    {
      name: 'should work for PT_CHANNEL user to hub token payments with type',
      payments: [{
        amountToken: '1',
        type: 'PT_CHANNEL',
        recipient: hubAddress,
      }],
      meta: { test: "This is a test"}
    },
    {
      name: 'should work for PT_CHANNEL user to hub token payments without type',
      payments: [{
        amountToken: '1',
        recipient: hubAddress,
      }],
    },
    {
      name: 'should work for PT_CUSTODIAL user to hub token payments',
      payments: [{
        amountToken: '1',
        type: 'PT_CUSTODIAL',
        recipient: receiver,
      }]
    },
    {
      name: 'should fail for invalid PT_CHANNEL user to hub payments',
      payments: [{
        amountToken: '1', 
        amountWei: '10',
        type: 'PT_CHANNEL',
        recipient: receiver,
      }],
      fails: /User does not have sufficient Wei balance for a transfer of value/
    },
    {
      name: 'should fail for invalid PT_CUSTODIAL user to hub payments',
      payments: [{
        amountToken: '1', 
        amountWei: '10',
        type: 'PT_CUSTODIAL',
        meta: {},
        recipient: receiver,
      }],
      fails: /User does not have sufficient Wei balance for a transfer of value/
    },
    {
      name: "should work for PT_LINK user token payments",
      payments: [{
        amountToken: '1',
        type: 'PT_LINK',
        meta: { secret: mkHash("0xff"), },
        recipient: eth.constants.AddressZero,
      }],
    },
    {
      name: "should work for PT_LINK user token payments without type",
      payments: [{
        amountToken: '1',
        meta: { secret: mkHash("0xff"), },
        recipient: eth.constants.AddressZero,
      }],
    },
    {
      name: "should fail for PT_LINK user token payments if secret is not provided",
      payments: [{
        amountToken: '1',
        type: 'PT_LINK' as PurchasePaymentType,
        recipient: eth.constants.AddressZero,
      }],
      fails: /Secret is not present/,
    },
    {
      name: 'should fail for PT_LINK user token payments if secret is not provided',
      payments: [{
        amountToken: '1',
        type: 'PT_LINK' as PurchasePaymentType,
        meta: { secret: 'secret' },
        recipient: eth.constants.AddressZero,
      }],
      fails: /Secret is not hex string/,
    },
    {
      name: "should work for a single thread payment to a receiver",
      payments: [{
        amountToken: '1',
        type: 'PT_THREAD' as PurchasePaymentType,
        recipient: receiver,
      }]
    },
    {
      name: "should work for a thread payment to a different receiver",
      payments: [
        {
          amountToken: '1', 
          amountWei: '0',
          type: 'PT_THREAD',
          recipient: receiver,
        },
        {
          aamountToken: '0', 
          amountWei: '1',
          type: 'PT_THREAD',
          recipient: receiver2,
        },
      ]
    },
    {
      name: "should work for mixed payments",
      payments: [
        {
          amountToken: '1', 
          amountWei: '0',
          type: 'PT_THREAD',
          recipient: receiver,
        },
        {
          amountToken: '1', 
          amountWei: '0',
          type: 'PT_LINK',
          meta: { secret: mkHash("0xff") },
          recipient: eth.constants.AddressZero,
        },
      ],
    }
  ], async ({ name, payments, fails, meta }) => {
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
      const isUser = p.recipient == connext.wallet.address
      // is thread payment?
      if ((p as any).type == "PT_THREAD") {
        // check that user has sent thread update
        const syncRes = connext.store.getState().runtime.syncResultsFromHub
        for (const res of syncRes) {
          assert.containSubset(res, {
            type: "thread",
            update: {
              state: {
                balanceWeiSender: '0',
                balanceWeiReceiver: (p as any).amountWei || '0',
                balanceTokenSender: '0',
                balanceTokenReceiver: (p as any).amountToken || '0',
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
            balanceWeiSender: (p as any).amountWei || '0',
            balanceTokenReceiver: '0',
            balanceTokenSender: (p as any).amountToken || '0',
          },
          sigUser: true,
          sigHub: false,
        })

        continue
      }

      connext.mockHub.assertReceivedUpdate({
        reason: 'Payment',
        args: {
          amountToken: (p as any).amountToken || '0',
          amountWei: (p as any).amountWei || '0',
          recipient: isUser ? 'user' : 'hub',
        } as PaymentArgs,
        sigUser: true,
        sigHub: isUser,
      })
    }
  })

  afterEach(async () => {
    await connext.stop()
  })
})
