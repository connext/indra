import { channelStateBigNumToString } from "../domain/Channel";
import { mkSig } from "../testing/stateUtils";
import { mkAddress, getChannelState } from "../testing/stateUtils";
import { PurchasePayment } from "../vendor/connext/types";
import { getTestRegistry, TestApiServer, assert } from '../testing'
import { channelUpdateFactory, tokenVal, channelNextState } from "../testing/factories";
import { PaymentMetaDao } from "../dao/PaymentMetaDao";

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

  it('should work', async () => {
    const chan = await channelUpdateFactory(registry, 'ConfirmPending', {
      balanceTokenUser: tokenVal(10),
    })

    const res = await app.withUser(chan.user).request
      .post('/payments/purchase')
      .send({
        payments: [
          {
            recipient: chan.state.recipient,
            amount: {
              wei: '0',
              token: tokenVal(1),
            },
            meta: {},
            type: 'PT_CHANNEL',
            update: {
              reason: 'Payment',
              state: channelNextState(chan.state, {
                balanceTokenUser: tokenVal(9),
                balanceTokenHub: tokenVal(1),
              }),
            },
          }
        ] as PurchasePayment[]
      })

    const { purchaseId } = res.body
    assert.ok(purchaseId)

    const payments = await paymentMetaDao.byPurchase(purchaseId)
    assert.containSubset(payments[0], {
      recipient: chan.state.recipient,
      sender: chan.user,
      amount: {
        wei: '0',
        token: tokenVal(1),
      },
    })

  })
})
