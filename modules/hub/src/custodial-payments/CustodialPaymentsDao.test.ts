import { Payment } from '../vendor/connext/types'
import { TestServiceRegistry } from '../testing'
import { PaymentArgs } from '../vendor/connext/types'
import { default as DBEngine } from '../DBEngine'
import { SQL } from '../DBEngine'
import { mkAddress } from '../testing/stateUtils'
import { assert, getTestRegistry } from '../testing'
import { channelUpdateFactory } from '../testing/factories'
import { CustodialPaymentsDao } from './CustodialPaymentsDao'
import { PaymentMetaDao } from '../dao/PaymentMetaDao'

export async function createTestPayment(
  registry: TestServiceRegistry,
  args: Partial<PaymentArgs> = {},
  paymentAmount: Partial<Payment> = {},
  recipient = mkAddress('0x555'),
) {
  const dao: CustodialPaymentsDao = registry.get('CustodialPaymentsDao')
  const paymentDao: PaymentMetaDao = registry.get('PaymentMetaDao')

  const { update, user } = await channelUpdateFactory(registry, {}, 'Payment', {
    amountWei: '69',
    amountToken: '420',
    ...args,
  })

  const paymentId = await paymentDao.save('foo', {
    recipient,
    amount: {
      amountWei: '69',
      amountToken: '420',
      ...paymentAmount,
    },
    type: 'PT_CHANNEL',
    meta: {},
  })

  console.log("UPD:", update)
  await dao.createCustodialPayment(paymentId, update.id)
  return { update, user, paymentId, recipient }
}


describe('CustodialPaymentsDao', () => {
  const registry = getTestRegistry()
  const db: DBEngine = registry.get('DBEngine')
  const dao: CustodialPaymentsDao = registry.get('CustodialPaymentsDao')

  beforeEach(() => registry.clearDatabase())

  describe('createCustodialPayment', () => {
    it('works', async () => {
      const { paymentId } = await createTestPayment(registry)
      assert.containSubset((await db.queryOne(SQL`select * from payments where id = ${paymentId}`)), {
        'amount_token': '420',
        'amount_wei': '69',
        'contract': '0xCCC0000000000000000000000000000000000000',
        'payment_type': 'channel-custodial',
        'purchase_id': 'foo',
        'recipient': '0x5550000000000000000000000000000000000000',
        'sender': '0xAAA0000000000000000000000000000000000000',
      })
    })

    it('fails if update does not match payment', async () => {
      await assert.isRejected(
        createTestPayment(registry, { amountWei: '5' }),
        /payment amount does not match update/
      )
    })
  })

})

