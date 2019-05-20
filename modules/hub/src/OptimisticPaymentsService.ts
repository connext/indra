import * as connext from 'connext'
import {
  OptimisticPurchasePaymentRow,
  OptimisticPurchasePaymentRowBN,
  PurchasePayment,
} from 'connext/types'

import ChannelsService from './ChannelsService'
import ChannelsDao from './dao/ChannelsDao'
import OptimisticPaymentDao from './dao/OptimisticPaymentDao'
import DBEngine from './DBEngine'
import PaymentsService from './PaymentsService'
import { maybe } from './util'
import log from './util/log'

const LOG = log('OptimisticPaymentsService')
const POLL_INTERVAL = 2 * 1000

export class OptimisticPaymentsService {
  private poller: connext.Poller

  constructor(
    private db: DBEngine,
    private opPaymentDao: OptimisticPaymentDao,
    private channelsDao: ChannelsDao,
    private paymentsService: PaymentsService,
    private channelsService: ChannelsService
  ) {
    this.poller = new connext.Poller({
      callback: this.pollOnce.bind(this),
      interval: POLL_INTERVAL,
      name: 'OptimisticPaymentsService',
      timeout: POLL_INTERVAL,
    })
  }

  public start(): any {
    return this.poller.start()
  }

  public stop(): any {
    return this.poller.stop()
  }

  public async pollOnce(): Promise<void> {
    // get all payments to be processed
    const newPayments = await this.opPaymentDao.getNewOptimisticPayments()
    for (const p of newPayments) {
      // each payment within the fetched set of payments will be done inside a transaction
      await this.db.withTransaction(async () => {
        const payeeChan = await this.channelsDao.getChannelOrInitialState(
          p.recipient
        )
        // do not proceed if channel is not open
        if (payeeChan.status !== 'CS_OPEN') {
          return
        }

        // TODO: expiry time on optimistic payments

        // if the hub has sufficient collateral, forward the
        // payment
        const paymentBig = connext.convert.Payment('bn', p.amount)
        const sufficientCollateral = (type: 'Token' | 'Wei'): boolean => {
          const hubKey = 'balance' + type + 'Hub'
          const paymentKey = 'amount' + type
          return payeeChan.state[hubKey].gte(paymentBig[paymentKey])
        }
        if (sufficientCollateral('Token') && sufficientCollateral('Wei')) {
          await this.sendChannelPayment(p)
        }
      })
      const [res, err] = await maybe(
        this.channelsService.doCollateralizeIfNecessary(
          p.recipient,
          p.amount.amountToken
        )
      )
      if (err) {
        LOG.error(
          `Error recollateralizing ${p.recipient}: ${'' + err}\n${err.stack}`
        )
      }

      // TODO: add thread payments as well
    }
  }

  private async sendChannelPayment(
    payment: OptimisticPurchasePaymentRowBN
  ): Promise<void> {
    // reconstruct purchase payment as if it came from user
    const purchasePayment: PurchasePayment = {
      amount: connext.convert.Payment("str", payment.amount),
      meta: payment.meta,
      recipient: payment.recipient,
      type: 'PT_CHANNEL',
      update: {
        args: {
          ...connext.convertPayment("str", payment.amount),
          recipient: "hub"
        },
        reason: 'Payment',
        txCount: null
      }
    }
    try {
      const redemptionId = await this.paymentsService.doChannelInstantPayment(
        purchasePayment,
        payment.paymentId,
        payment.channelUpdateId
      )

      await this.opPaymentDao.addOptimisticPaymentRedemption(
        payment.paymentId,
        redemptionId
      )
    } catch (e) {
      // if the custodial payment fails, the payment should fail
      LOG.info('Error redeeming optimistic channel payment. ID: {id}, error: {e}', {
        e,
        id: payment.paymentId
      })
    }
    // TODO: recollateralization here?
  }

  // TODO: handle hub reverting after a set expiry
  private async revertPayment(
    payment: OptimisticPurchasePaymentRow
  ): Promise<void> {
    // how to handle this in the case of this being one failed
    // payment in a purchase? should all the payments that make up
    // that purchase be reverted?

    // mark the payment as failed
    await this.opPaymentDao.optimisticPaymentFailed(payment.paymentId)
  }
}
