import { PurchaseRequest, PurchasePayment, PaymentArgs, SyncResult } from '../types'
import { AbstractController } from './AbstractController'
import { getChannel } from '../lib/getChannel'


export default class BuyController extends AbstractController {
  public async buy(purchase: PurchaseRequest): Promise<{ purchaseId: string }> {
    // Small hack to inject the hub's address; can be removed eventually
    purchase = {
      ...purchase,
      payments: purchase.payments.map(payment => ({
        ...payment,
        recipient: payment.recipient === '$$HUB$$' ? process.env.HUB_ADDRESS! : payment.recipient
      })),
    }

    // Sign the payments
    const signedPayments: PurchasePayment[] = []

    let curChannelState = getChannel(this.store)
    for (const payment of purchase.payments) {
      if (payment.type == 'PT_THREAD')
        throw new Error('TODO: REB-36 (enable threads)')

      if (payment.type != 'PT_CHANNEL' && payment.type != 'PT_CUSTODIAL')
        throw new Error('Invalid payment type: ' + payment.type)

      const args: PaymentArgs = {
        recipient: 'hub',
        ...payment.amount
      }
      const newChannelState = await this.connext.signChannelState(
        this.validator.generateChannelPayment(
          curChannelState,
          args,
        )
      )

      signedPayments.push({
        ...payment,
        type: payment.type as any,
        update: {
          reason: 'Payment',
          args: args,
          sigUser: newChannelState.sigUser,
          txCount: newChannelState.txCountGlobal,
        },
      })

      curChannelState = newChannelState
    }

    const res = await this.connext.hub.buy(purchase.meta, signedPayments)
    this.connext.syncController.handleHubSync(res.sync)
    return res
  }

}
