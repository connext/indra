import { ethers as eth } from 'ethers'

import {
  assert,
  mkAddress,
  mkHash,
  parameterizedTests,
} from '../testing'
import { MockConnextInternal, MockHub, MockStore } from '../testing/mocks'
import {
  PartialPurchasePaymentRequest,
  Payment,
  PaymentArgs,
  PurchasePayment,
  PurchasePaymentType,
} from '../types'

describe('BuyController: assignPaymentTypes', async () => {
  const receiver = mkAddress('0x22c')

  for (const tc of [
    {
      expected: {
        amount: {
          amountWei: '0',
        },
      },
      name: 'should retain a type if its provided',
      payment: {
        amountToken: '15',
        recipient: receiver,
        type: 'PT_LINK',
      },
    },
    {
      expected: {
        amount: {
          amountWei: '0',
        },
        type: 'PT_LINK',
      },
      name: 'should assign a PT_LINK payment if there is a secret provided in the meta',
      payment: {
        amountToken: '15',
        meta: { secret: mkHash('0xss') },
        recipient: receiver,
      },
    },
    {
      expected: {
        amount: { amountWei: '0' },
        meta: {},
        type: 'PT_CUSTODIAL',
      },
      name: 'should assign a PT_CUSTODIAL if the amount is greater than ' +
        'the amount the hub will collateralize',
      payment: {
        amountToken: '150',
        recipient: receiver,
      },
    },
    {
      expected: {
        amount: { amountWei: '0' },
        meta: {},
        type: 'PT_CHANNEL',
      },
      name: 'should assign a PT_CHANNEL if the payment is to the hub',
      payment: {
        amountToken: '10',
        recipient: mkAddress('0xhhh'),
      },
    },
    {
      expected: {
        amount: { amountWei: '0' },
        meta: {},
        type: 'PT_OPTIMISTIC',
      },
      name: 'should assign a PT_OPTIMISTIC if the type is not provided, ' +
        'and the hub can handle forwarding the payment (below max)',
      payment: {
        amountToken: '10',
        recipient: receiver,
      },
    },
  ]) {

    it(tc.name, async () => {
      const user = mkAddress('0x7fab')
      const mockStore: MockStore = new MockStore()
      mockStore.setHubAddress()
      const connext: MockConnextInternal = new MockConnextInternal({
        store: mockStore.createStore(),
        user,
      })
      await connext.start()
      const ans = await connext.buyController.assignPaymentType(
        tc.payment as PartialPurchasePaymentRequest)
      const { amountToken, amountWei, ...res } = tc.payment as PartialPurchasePaymentRequest
      assert.containSubset(ans, {
        ...res,
        amount: {
          amountToken,
          amountWei,
        },
        ...tc.expected,
      })
    })

  }
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
      balanceToken: [10, 10],
      balanceWei: [5, 5],
    })
    connext = new MockConnextInternal({
      store: mockStore.createStore(),
    })
    user = connext.wallet.address
    secret = connext.generateSecret()
  })

  parameterizedTests([
    {
      meta: { test: 'This is a test'},
      name: 'should work for PT_CHANNEL user to hub token payments with type',
      payments: [{
        amountToken: '1',
        recipient: hubAddress,
        type: 'PT_CHANNEL',
      }],
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
        recipient: receiver,
        type: 'PT_CUSTODIAL',
      }],
    },

    {
      fails: /User does not have sufficient Wei balance for a transfer of value/,
      name: 'should fail for invalid PT_CHANNEL user to hub payments',
      payments: [{
        amountToken: '1',
        amountWei: '10',
        recipient: receiver,
        type: 'PT_CHANNEL',
      }],
    },

    {
      fails: /User does not have sufficient Wei balance for a transfer of value/,
      name: 'should fail for invalid PT_CUSTODIAL user to hub payments',
      payments: [{
        amountToken: '1',
        amountWei: '10',
        meta: {},
        recipient: receiver,
        type: 'PT_CUSTODIAL',
      }],
    },

    {
      name: 'should work for PT_LINK user token payments',
      payments: [{
        amountToken: '1',
        meta: { secret: mkHash('0xff') },
        recipient: eth.constants.AddressZero,
        type: 'PT_LINK',
      }],
    },

    {
      name: 'should work for PT_LINK user token payments without type',
      payments: [{
        amountToken: '1',
        meta: { secret: mkHash('0xff') },
        recipient: eth.constants.AddressZero,
      }],
    },

    {
      fails: /Secret is not present/,
      name: 'should fail for PT_LINK user token payments if secret is not provided',
      payments: [{
        amountToken: '1',
        recipient: eth.constants.AddressZero,
        type: 'PT_LINK' as PurchasePaymentType,
      }],
    },

    {
      fails: /Secret is not hex string/,
      name: 'should fail for PT_LINK user token payments if secret is not provided',
      payments: [{
        amountToken: '1',
        meta: { secret: 'secret' },
        recipient: eth.constants.AddressZero,
        type: 'PT_LINK' as PurchasePaymentType,
      }],
    },

    {
      name: 'should work for a single thread payment to a receiver',
      payments: [{
        amountToken: '1',
        recipient: receiver,
        type: 'PT_THREAD' as PurchasePaymentType,
      }],
    },

    {
      name: 'should work for a thread payment to a different receiver',
      payments: [
        {
          amountToken: '1',
          amountWei: '0',
          recipient: receiver,
          type: 'PT_THREAD',
        },
        {
          aamountToken: '0',
          amountWei: '1',
          recipient: receiver2,
          type: 'PT_THREAD',
        },
      ],
    },

    {
      name: 'should work for mixed payments',
      payments: [
        {
          amountToken: '1',
          amountWei: '0',
          recipient: receiver,
          type: 'PT_THREAD',
        },
        {
          amountToken: '1',
          amountWei: '0',
          meta: { secret: mkHash('0xff') },
          recipient: eth.constants.AddressZero,
          type: 'PT_LINK',
        },
      ],
    },
  ], async ({ name, payments, fails, meta }: any): Promise<any> => {
    await connext.start()

    if (fails) {
      await assert.isRejected(
        connext.buyController.buy({
          meta: meta || {},
          payments: payments as any,
        }),
        fails,
      )
      return
    }

    await connext.buyController.buy({
      meta: meta || {},
      payments: payments as any,
    })

    await new Promise((res: any): any => setTimeout(res, 20))

    // hub should receive the user-signed update
    for (const p of payments) {
      // is hub to user payment?
      const isUser = p.recipient === connext.wallet.address
      // is thread payment?
      if ((p as any).type === 'PT_THREAD') {
        // check that user has sent thread update
        const syncRes = connext.store.getState().runtime.syncResultsFromHub
        for (const res of syncRes) {
          assert.containSubset(res, {
            type: 'thread',
            update: {
              state: {
                balanceTokenReceiver: (p as any).amountToken || '0',
                balanceTokenSender: '0',
                balanceWeiReceiver: (p as any).amountWei || '0',
                balanceWeiSender: '0',
                receiver: p.recipient,
                txCount: 1,
              },
            },
          })
        }
        // check that there is an open thread
        await new Promise((r: any): any => setTimeout(r, 20))

        connext.mockHub.assertReceivedUpdate({
          args: {
            balanceTokenReceiver: '0',
            balanceTokenSender: (p as any).amountToken || '0',
            balanceWeiReceiver: '0',
            balanceWeiSender: (p as any).amountWei || '0',
          },
          reason: 'OpenThread',
          sigHub: false,
          sigUser: true,
        })

        continue
      }

      connext.mockHub.assertReceivedUpdate({
        args: {
          amountToken: (p as any).amountToken || '0',
          amountWei: (p as any).amountWei || '0',
          recipient: isUser ? 'user' : 'hub',
        },
        reason: 'Payment',
        sigHub: isUser,
        sigUser: true,
      })
    }
  })

  afterEach(async () => {
    await connext.stop()
  })
})
