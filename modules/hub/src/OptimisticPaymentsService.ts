import log from "./util/log";
import { Poller } from "./vendor/connext/lib/poller/Poller";
import ChannelsDao from "./dao/ChannelsDao";
import DBEngine from "./DBEngine";
import { convertChannelState, convertPayment, PurchasePayment } from "./vendor/connext/types";
import OptimisticPaymentDao from "./dao/OptimisticPaymentDao";
import { OptimisticPurchasePaymentRow } from "./domain/OptimisticPayment";
import PaymentsService from "./PaymentsService";

const LOG = log('OptimisticPaymentsService')

const POLL_INTERVAL = 1000

export class OptimisticPaymentsService {
  private poller: Poller

  constructor(
    private db: DBEngine,
    private opPaymentDao: OptimisticPaymentDao,
    private channelsDao: ChannelsDao,
    private paymentsService: PaymentsService,
  ) {
    this.poller = new Poller({
      name: 'OptimisticPaymentsService',
      interval: POLL_INTERVAL,
      callback: this.pollOnce.bind(this),
      timeout: POLL_INTERVAL,
    })
  }

  public start() {
    return this.poller.start()
  }

  public stop() {
    return this.poller.stop()
  }

  async pollOnce() {
    await this.db.withTransaction(async () => {
      // get all payments to be processed
      const newPayments = await this.opPaymentDao.getNewOptimisticPayments()
      for (const p of newPayments) {
        const payeeChan = await this.channelsDao.getChannelOrInitialState(p.recipient)
        // do not proceed if channel is not open
        if (payeeChan.status != "CS_OPEN") {
          continue
        }

        // TODO: expiry time on optimistic payments

        // check if the payee channel has sufficient collateral
        const payeeState = convertChannelState("bignumber", payeeChan.state)
        const paymentBig = convertPayment("bignumber", p.amount)
        const sufficientCollateral = (type: 'Token' | 'Wei') => {
          const hubKey = 'balance' + type + 'Hub'
          const paymentKey = 'amount' + type
          return payeeState[hubKey].gte(paymentBig[paymentKey])
        }
        if (
          !sufficientCollateral('Token') || !sufficientCollateral('Wei')
        ) {
          // if it does not, wait for next polling
          continue
        }

        // if the hub has sufficient collateral, forward the
        // payment
        await this.sendChannelPayment(p)

        // TODO: add thread payments as well
      }
    })
  }

  private async sendChannelPayment(payment: OptimisticPurchasePaymentRow): Promise<void> {
    // reconstruct purchase payment as if it came from user
    const purchasePayment: PurchasePayment = {
      recipient: payment.recipient,
      type: "PT_CHANNEL",
      amount: payment.amount,
      meta: payment.meta,
      update: {
        reason: "Payment",
        args: {
          ...payment.amount,
          recipient: "hub"
        },
        txCount: null,
      },
    }
    try {
      const redemptionId = await this.paymentsService.doChannelInstantPayment(purchasePayment, payment.paymentId, payment.channelUpdateId)

      await this.opPaymentDao.addOptimisticPaymentRedemption(payment.paymentId, redemptionId)
    } catch (e) {
      // if the custodial payment fails, the payment should fail
      LOG.info("Error redeeming optimistic channel payment. ID: {id}", {
        id: payment.paymentId,
      })
    }
    // TODO: recollateralization here?
  }

  // TODO: handle hub reverting after a set expiry
  private async revertPayment(payment: OptimisticPurchasePaymentRow): Promise<void> {
    // how to handle this in the case of this being one failed
    // payment in a purchase? should all the payments that make up
    // that purchase be reverted?

    // mark the payment as failed
    await this.opPaymentDao.optimisticPaymentFailed(payment.paymentId)
  }
}