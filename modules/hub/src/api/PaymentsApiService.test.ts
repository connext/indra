import { mkSig } from "../testing/stateUtils";
import { PurchasePayment } from "../vendor/connext/types";
import { getTestRegistry, TestApiServer, assert } from '../testing'
import { channelUpdateFactory, tokenVal, channelNextState } from "../testing/factories";
import { PaymentMetaDao } from "../dao/PaymentMetaDao";
import Config from "../Config";

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
})
