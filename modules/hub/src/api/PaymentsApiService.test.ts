import { mkSig } from "../testing/stateUtils";
import { PurchasePayment } from "../vendor/connext/types";
import { getTestRegistry, TestApiServer, assert } from '../testing'
import { channelUpdateFactory, tokenVal, channelNextState } from "../testing/factories";
import { PaymentMetaDao } from "../dao/PaymentMetaDao";
import Config from "../Config";
import { emptyAddress } from "../vendor/connext/Utils";

describe('PaymentsApiService', () => {
  const registry = getTestRegistry({
    'Web3': {
      eth: {
        Contract: () => ({}),
        sign: () => mkSig('0x5a'),
      },
    },
  })
  const paymentMetaDao: PaymentMetaDao = registry.get('PaymentMetaDao')

  const app: TestApiServer = registry.get('TestApiServer')
  const config: Config = registry.get('Config')

  beforeEach(async () => {
    await registry.clearDatabase()
  })

  it('should work', async () => {
    const chan = await channelUpdateFactory(registry, {
      balanceTokenUser: tokenVal(10),
    })

    const res = await app.withUser(chan.user).request
      .post('/payments/purchase')
      .send({
        meta: {},
        payments: [
          {
            recipient: config.hotWalletAddress,
            amount: {
              amountWei: '0',
              amountToken: tokenVal(1),
            },
            meta: {},
            type: 'PT_CHANNEL',
            update: {
              reason: 'Payment',
              sigUser: chan.state.sigUser,
              txCount: chan.state.txCountGlobal + 1,
              args: {
                amountWei: '0',
                amountToken: tokenVal(1),
                recipient: 'hub'
              }
            },
          }
        ] as PurchasePayment[]
      })

    assert.equal(res.status, 200, JSON.stringify(res.body))
    const { purchaseId } = res.body
    assert.ok(purchaseId)

    const payments = await paymentMetaDao.byPurchase(purchaseId)
    assert.containSubset(payments[0], {
      recipient: config.hotWalletAddress,
      sender: chan.user,
      amount: {
        amountWei: '0',
        amountToken: tokenVal(1),
      },
    })
  })

  it('should work for instant custodial payment', async () => {
    const sender = await channelUpdateFactory(registry, {
      balanceTokenUser: tokenVal(10),
    })

    const receiver = await channelUpdateFactory(registry, {
      balanceTokenHub: tokenVal(1),
    })

    const res = await app.withUser(sender.user).request
      .post('/payments/purchase')
      .send({
        meta: {},
        payments: [
          {
            recipient: receiver.user,
            amount: {
              amountWei: '0',
              amountToken: tokenVal(1),
            },
            meta: {},
            type: 'PT_CHANNEL',
            update: {
              reason: 'Payment',
              sigUser: sender.state.sigUser,
              txCount: sender.state.txCountGlobal + 1,
              args: {
                amountWei: '0',
                amountToken: tokenVal(1),
                recipient: 'hub'
              }
            },
          }
        ] as PurchasePayment[]
      })

    assert.equal(res.status, 200, JSON.stringify(res.body))
    const { purchaseId } = res.body
    assert.ok(purchaseId)
  })

  it('should work for sending linked payments', async () => {
    const chan = await channelUpdateFactory(registry, {
      balanceTokenUser: tokenVal(10),
    })

    const res = await app.withUser(chan.user).request
      .post('/payments/purchase')
      .send({
        meta: {},
        payments: [
          {
            recipient: emptyAddress,
            amount: {
              amountWei: '0',
              amountToken: tokenVal(1),
            },
            meta: {},
            type: 'PT_LINK',
            secret: 'sadlkj',
            update: {
              reason: 'Payment',
              sigUser: chan.state.sigUser,
              txCount: chan.state.txCountGlobal + 1,
              args: {
                amountWei: '0',
                amountToken: tokenVal(1),
                recipient: 'hub'
              }
            },
          }
        ] as PurchasePayment[]
      })

    assert.equal(res.status, 200, JSON.stringify(res.body))
    const { purchaseId } = res.body
    assert.ok(purchaseId)

    const payments = await paymentMetaDao.byPurchase(purchaseId)
    assert.containSubset(payments[0], {
      recipient: emptyAddress,
      sender: chan.user,
      amount: {
        amountWei: '0',
        amountToken: tokenVal(1),
      },
      type: 'PT_LINK',
    })
  })

  it('should work for users redeeming payments', async () => {
    const chan = await channelUpdateFactory(registry, {
      balanceTokenUser: tokenVal(10),
    })

    // add linked payment to the db
    await app.withUser(chan.user).request
    .post('/payments/purchase')
    .send({
      meta: {},
      payments: [
        {
          recipient: emptyAddress,
          amount: {
            amountWei: '0',
            amountToken: tokenVal(1),
          },
          meta: {},
          type: 'PT_LINK',
          secret: 'sadlkj',
          update: {
            reason: 'Payment',
            sigUser: chan.state.sigUser,
            txCount: chan.state.txCountGlobal + 1,
            args: {
              amountWei: '0',
              amountToken: tokenVal(1),
              recipient: 'hub'
            }
          },
        }
      ] as PurchasePayment[]
    })

    console.log('linked payment inserted into db')

    // redeem with address not in db
    const redeemer = "0x2932b7A2355D6fecc4b5c0B6BD44cC31df247a2e".toLowerCase()
    const res = await app.withUser(redeemer).request
      .post(`/payments/redeem/${redeemer}`)
      .send({ secret: "sadlkj"})

    assert.equal(res.status, 200, JSON.stringify(res.body))
    const { paymentRow } = res.body
    console.log('paymentRow', res.body)
    assert.ok(paymentRow)

    const payments = await paymentMetaDao.byPurchase(paymentRow.purchaseId)
    assert.containSubset(payments[0], {
      recipient: redeemer,
      sender: chan.user,
      amount: {
        amountWei: '0',
        amountToken: tokenVal(1),
      },
      type: 'PT_LINK',
      secret: "sadlkj"
    })

    const linked = await paymentMetaDao.getLinkedPayment('sadlkj')
    console.log('linked', linked)
  })
})
