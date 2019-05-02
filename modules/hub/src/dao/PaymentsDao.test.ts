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
    await assert.isRejected(paymentsDao.createChannelInstantPayment(0, 1, 1))
  })

  it('should reject when recipient is different than disbursed user', async () => {
    const paymentId = await paymentMetaDao.save('abc123', {
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

    const r = await channelUpdateFactory(registry, { user: mkAddress('0xa') })
    const d = await channelUpdateFactory(registry, { user: mkAddress('0xb') })
    await assert.isRejected(paymentsDao.createChannelInstantPayment(paymentId, d.update.id, r.update.id))
  })

  it('should create a custodial payment', async () => {
    // save a payment for this update
    const paymentId = await paymentMetaDao.save('abc123', {
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

    const r = await channelUpdateFactory(registry, { user: mkAddress('0xa') })
    const d = await channelUpdateFactory(registry, { user: mkAddress('0xb') })
    await paymentsDao.createChannelInstantPayment(paymentId, d.update.id, r.update.id)

    const db = registry.get('DBEngine')
    assert.containSubset((await db.queryOne('SELECT * FROM payments_channel_instant')), {
      payment_id: '' + paymentId,
      disbursement_id: '' + d.update.id,
      update_id: '' + r.update.id,
    })

    assert.containSubset((await db.queryOne(`select * from payments where id = ${paymentId}`)), { 'amount_token': '2000000000000000000',
      'amount_wei': '0',
      'contract': '0xCCC0000000000000000000000000000000000000',
      'meta': {
        'foo': 42
      },
      'payment_type': 'PT_CHANNEL',
      'purchase_id': 'abc123',
      'recipient': '0xb000000000000000000000000000000000000000',
      'sender': '0xa000000000000000000000000000000000000000',
    })
  })
})
