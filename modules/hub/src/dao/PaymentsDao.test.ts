import { assert, getTestRegistry } from '../testing'
import PaymentsDao from "./PaymentsDao";
import { channelUpdateFactory, tokenVal } from '../testing/factories';
import { PaymentMetaDao } from './PaymentMetaDao';
import { mkAddress } from '../testing/stateUtils';

describe('PaymentsDao', () => {
  const registry = getTestRegistry()
  const paymentsDao: PaymentsDao = registry.get('PaymentsDao')
  const paymentMetaDao: PaymentMetaDao = registry.get('PaymentMetaDao')

  beforeEach(async () => {
    await registry.clearDatabase()
  })

  it('should reject when there is no linked payments', async () => {
    await assert.isRejected(paymentsDao.createCustodialPayment(0, 1))
  })

  it('should reject when recipient is different than disbursed user', async () => {
    // create an update in the channel
    let r = await channelUpdateFactory(registry, { user: mkAddress('0xa') })

    // save a payment for this update
    const paymentId = await paymentMetaDao.save('abc123', r.update.id, {
      type: 'PT_CHANNEL',
      amount: {
        amountToken: tokenVal(2),
        amountWei: '0',
      },
      recipient: mkAddress('0x123'),
      meta: {
        foo: 42,
      },
    })
    
    r = await channelUpdateFactory(registry, { user: mkAddress('0xb') })
    await assert.isRejected(paymentsDao.createCustodialPayment(paymentId, r.update.id))
  })

  it('should create a custodial payment', async () => {
    // create an update in the channel
    let r = await channelUpdateFactory(registry, { user: mkAddress('0xa') })

    // save a payment for this update
    const paymentId = await paymentMetaDao.save('abc123', r.update.id, {
      type: 'PT_CHANNEL',
      amount: {
        amountToken: tokenVal(2),
        amountWei: '0',
      },
      recipient: mkAddress('0xb'),
      meta: {
        foo: 42,
      },
    })
    
    r = await channelUpdateFactory(registry, { user: mkAddress('0xb') })
    await paymentsDao.createCustodialPayment(paymentId, r.update.id)

    const db = registry.get('DBEngine')
    assert.containSubset((await db.query('SELECT * FROM custodial_payments')).rows[0], {
      payment_id: '' + paymentId,
      disbursement_id: '' + r.update.id,
    })
  })
})
