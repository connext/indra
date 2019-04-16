import OptimisticPaymentDao from "./OptimisticPaymentDao";
import { PaymentMetaDao } from "./PaymentMetaDao";
import { tokenVal, channelUpdateFactory } from "../testing/factories";
import { getTestRegistry, assert } from "../testing";
import { mkAddress } from "../testing/stateUtils";

describe("OptimisticPaymentDao", () => {
  const registry = getTestRegistry()
  const optimisticDao: OptimisticPaymentDao = registry.get('OptimisticPaymentDao')
  const paymentMetaDao: PaymentMetaDao = registry.get('PaymentMetaDao')

  beforeEach(async () => {
    await registry.clearDatabase()
  })

  it('should create an optimistic payment', async () => {
    // save a payment for this update
    const paymentId = await paymentMetaDao.save('abc123', {
      type: 'PT_OPTIMISTIC',
      amount: {
        amountToken: tokenVal(2),
        amountWei: '0',
      },
      recipient: mkAddress('0xb'),
      meta: {
        foo: 42,
      },
    })

    const d = await channelUpdateFactory(registry, { user: mkAddress('0xa') })
    await optimisticDao.createOptimisticPayment(paymentId, d.update.id)

    const db = registry.get('DBEngine')
    assert.containSubset((await db.queryOne('SELECT * FROM payments_optimistic')), {
      payment_id: '' + paymentId,
      channel_update_id: '' + d.update.id,
    })

    assert.containSubset((await db.queryOne(`select * from payments where id = ${paymentId}`)), { 'amount_token': '2000000000000000000',
      'amount_wei': '0',
      'contract': '0xCCC0000000000000000000000000000000000000',
      'meta': {
        'foo': 42
      },
      'payment_type': 'PT_OPTIMISTIC',
      'purchase_id': 'abc123',
      'recipient': '0xb000000000000000000000000000000000000000',
      'sender': '0xa000000000000000000000000000000000000000',
    })
  })

  it("getNewOptimisticPayments", async () => {
    // first load up with a new payment
    const newPaymentId = await paymentMetaDao.save('abc123', {
      type: 'PT_OPTIMISTIC',
      amount: {
        amountToken: tokenVal(2),
        amountWei: '0',
      },
      recipient: mkAddress('0xb'),
      meta: {
        foo: 42,
      },
    })

    const d = await channelUpdateFactory(registry, { user: mkAddress('0xa') })
    await optimisticDao.createOptimisticPayment(newPaymentId, d.update.id)
    let payments = await optimisticDao.getNewOptimisticPayments()

    assert.equal(payments.length, 1)
    assert.containSubset(payments[0], {
      channelUpdateId: Number(d.update.id),
      status: "NEW",
      paymentId: newPaymentId,
      amount: {
        amountWei: '0',
        amountToken: tokenVal(2).toString(),
      },
      recipient: "0xb000000000000000000000000000000000000000",
      sender: "0xa000000000000000000000000000000000000000"
    })

    // update status
    await optimisticDao.optimisticPaymentFailed(newPaymentId)
    const db = registry.get('DBEngine')
    assert.containSubset((await db.queryOne('SELECT * FROM payments_optimistic')), {
      payment_id: '' + newPaymentId,
      channel_update_id: '' + d.update.id,
    })

    payments = await optimisticDao.getNewOptimisticPayments()
    assert.equal(payments.length, 0)

  })

})