import * as connext from 'connext'
import {
  Payment,
  PaymentArgs,
  PurchasePayment,
  PurchaseRowWithPayments,
  UpdateRequest,
} from 'connext/types'
import * as eth from 'ethers'

import ChannelsService from './ChannelsService'
import Config from './Config'
import { CustodialPaymentsDao } from './custodial-payments/CustodialPaymentsDao'
import ChannelsDao from './dao/ChannelsDao'
import GlobalSettingsDao from './dao/GlobalSettingsDao'
import OptimisticPaymentDao from './dao/OptimisticPaymentDao'
import { PaymentMetaDao } from './dao/PaymentMetaDao'
import PaymentsDao from './dao/PaymentsDao'
import { default as DBEngine } from './DBEngine'
import { SignerService } from './SignerService'
import ThreadsService from './ThreadsService'
import { maybe, prettySafeJson, toBN } from './util'
import { assertUnreachable } from './util/assertUnreachable'
import { default as log } from './util/log'

type MaybeResult<T> = (
  { error: true; msg: string } |
  { error: false; res: T }
)

const emptyAddress = eth.constants.AddressZero
const LOG = log('PaymentsService')

export default class PaymentsService {
  constructor(
    private channelsService: ChannelsService,
    private threadsService: ThreadsService,
    private signerService: SignerService,
    private paymentsDao: PaymentsDao,
    private paymentMetaDao: PaymentMetaDao,
    private optimisticPaymentDao: OptimisticPaymentDao,
    private channelsDao: ChannelsDao,
    private custodialPaymentsDao: CustodialPaymentsDao,
    private validator: connext.Validator,
    private config: Config,
    private db: DBEngine,
    private gsd: GlobalSettingsDao,
  ) {}

  public async doPurchase(
    user: string,
    meta: any,
    payments: PurchasePayment[],
  ): Promise<MaybeResult<{ purchaseId: string }>> {
    return this.db.withTransaction(() => this._doPurchase(user, meta, payments))
  }

  private async _doPurchase(
    user: string,
    meta: any,
    payments: PurchasePayment[],
  ): Promise<MaybeResult<{ purchaseId: string }>> {
    const purchaseId = this.generatePurchaseId()
    const afterPayments: Array<() => Promise<void>> = []

    for (let payment of payments) {
      let afterPayment = null

      if (payment.type == 'PT_CHANNEL') {
        // normal payment
        // TODO: should we check if recipient == hub here?
        if (payment.update.reason !== 'Payment' && payment.update.reason !== 'OpenThread') {
          throw new Error(
            `Payment updates must be either reason = "Payment" or reason = "OpenThread"` +
            `payment: ${prettySafeJson(payment)}`
          )
        }
        const row = await this.channelsService.doUpdateFromWithinTransaction(user, {
          args: payment.update.args,
          reason: payment.update.reason,
          sigUser: payment.update.sigUser,
          txCount: payment.update.txCount
        })

        // If the payment's recipient is not the hub, create an instant
        // custodial payment (but only after the row in `payments` has been
        // created, since the `custodial_payments` table references that row)
        afterPayment = paymentId => afterPayments.push(async () => {
          if (payment.recipient !== this.config.hotWalletAddress && payment.recipient !== emptyAddress) {
            try {
              await this.doChannelInstantPayment(payment, paymentId, row.id)
            } finally {
              // Check to see if collateral is needed, even if the tip failed
              const [res, err] = await maybe(this.channelsService.doCollateralizeIfNecessary(payment.recipient, toBN(payment.amount.amountToken)))
              if (err) {
                LOG.error(`Error recollateralizing ${payment.recipient}: ${'' + err}\n${err.stack}`)
              }
            }
          } else {
            await this.paymentsDao.createHubPayment(paymentId, row.id)
          }
        })

      } else if (payment.type == 'PT_CUSTODIAL') {
        // normal payment
        const row = await this.channelsService.doUpdateFromWithinTransaction(user, {
          args: payment.update.args,
          reason: 'Payment',
          sigUser: payment.update.sigUser,
          txCount: payment.update.txCount
        })

        afterPayment = paymentId => afterPayments.push(async () => {
          await this.custodialPaymentsDao.createCustodialPayment(paymentId, row.id)
        })

      } else if (payment.type == 'PT_THREAD') {
        const row = await this.threadsService.update(
          user,
          payment.recipient,
          connext.convert.ThreadState('bn', payment.update.state),
        )

        afterPayment = paymentId => afterPayments.push(async () => {
          await this.paymentsDao.createThreadPayment(paymentId, row.id)
        })

      } else if (payment.type == 'PT_LINK') {
        if (payment.recipient != emptyAddress) {
          throw new Error(`Linked payments must have no recipient`)
        }

        if (!payment.meta.secret) {
          throw new Error(`No secret detected on linked payment.`)
        }

        // update users channel
        const row = await this.channelsService.doUpdateFromWithinTransaction(user, {
          args: payment.update.args,
          reason: 'Payment',
          sigUser: payment.update.sigUser,
          txCount: payment.update.txCount
        })

        afterPayment = paymentId => afterPayments.push(async () => {
          await this.paymentsDao.createLinkPayment(paymentId, row.id, payment.meta.secret)
        })

      } else if (payment.type == 'PT_OPTIMISTIC') {
        // if there is collateral, send normal channel payment
        if (payment.update.reason !== "Payment") {
          throw new Error("The `PT_OPTIMISTIC` type has not been tested with anything but payment channel updates")
        }

        // check is also performed on optimistic poller before sending
        // any channel updates
        if ((payment.update.args as PaymentArgs).recipient !== "hub") {
          throw new Error(`Payment must be signed to hub in order to forward, payment: ${prettySafeJson(payment)}`)
        }

        // make update in users channel
        const row = await this.channelsService.doUpdateFromWithinTransaction(user, {
          args: payment.update.args,
          reason: payment.update.reason,
          sigUser: payment.update.sigUser,
          txCount: payment.update.txCount
        })

        afterPayment = paymentId => afterPayments.push(async () => {
          const paymentToHub = payment.recipient == this.config.hotWalletAddress || payment.recipient == emptyAddress

          if (paymentToHub) {
            await this.paymentsDao.createHubPayment(paymentId, row.id)
            // add the channel update id as the redemption id as well
            // TODO: should hub payments labeled as optimistic be
            // added to that table as well?
            return
          }

          // add entry to optimistic payments table
          await this.optimisticPaymentDao.createOptimisticPayment(paymentId, row.id)

          // the optimistic payments table will process the payments there
          // on a poller, but do not collateralize
          const [res, err] = await maybe(
            this.channelsService.doCollateralizeIfNecessary(payment.recipient)
          )
          if (err) {
            LOG.error(`Error recollateralizing ${payment.recipient}: ${'' + err}\n${err.stack}`)
          }
        })

      } else {
        assertUnreachable(payment as never, 'invalid payment type: ' + (payment as any).type)
      }

      // Note: this handling of meta isn't ideal. In the future, we should have
      // a Purchase table to store the purchase metadata instead of merging it
      // into payment metadata.
      const paymentId = await this.paymentMetaDao.save(purchaseId, {
        recipient: payment.recipient,
        amount: payment.amount,
        type: payment.type,
        meta: {
          ...meta,
          ...payment.meta,
        },
      })
      if (afterPayment)
        afterPayment(paymentId)
    }

    for (let p of afterPayments) {
      await p()
    }

    return {
      error: false,
      res: { purchaseId }
    }
  }

  // TODO: Need to check with Rahul about whether or not the public
  // wrapper is needed and how to handle a meta object here (same as 
  // above?)
  public async doRedeem(
    user: string,
    secret: string,
  ): Promise<MaybeResult<{ purchaseId: string, amount: Payment }>> {
    return this.db.withTransaction(() => this._doRedeem(user, secret))
  }

  private async _doRedeem(user: string, secret: string): Promise<MaybeResult<{ purchaseId: string | null, amount: Payment | null }>> {
    const channel = await this.channelsDao.getChannelOrInitialState(user)
    // channel checks
    if (channel.status !== 'CS_OPEN') {
      throw new Error('Channel is not open: ' + user)
    }

    const payment = await this.paymentMetaDao.getLinkedPayment(secret)
    if (!payment) {
      throw new Error('Error finding payment.')
    }
    if (payment.recipient != emptyAddress) {
      return {
        error: true,
        msg: 'Payment has been redeemed.'
      }
    }
    // if hub can afford the payment, sign and forward payment
    // otherwise, collateralize the channel
    const prev = connext.convert.ChannelState('bn', channel.state)
    const amt = connext.convert.Payment('bn', payment.amount)

    // always check for collateralization regardless of payment status
    const [res, err] = await maybe(this.channelsService.doCollateralizeIfNecessary(user))
    if (err) {
      LOG.error(`Error recollateralizing ${user}: ${'' + err}\n${err.stack}`)
    }

    if (this.validator.cantAffordFromBalance(prev, amt, "hub")) {
      // hub cannot afford payment, collateralize and return
      return {
        error: false,
        res: { purchaseId: null, amount: null }
      }
    }

    let purchaseId = null
    let amount = null

    const paymentArgs = {
      ...payment.amount,
      recipient: 'user'
    } as PaymentArgs

    const unsignedStateHubToRecipient = this.validator.generateChannelPayment(
      connext.convert.ChannelState('str', channel.state),
      paymentArgs
    )
    const signedStateHubToRecipient = await this.signerService.signChannelState(unsignedStateHubToRecipient)
    const disbursement = await this.channelsDao.applyUpdateByUser(
      user,
      'Payment',
      this.config.hotWalletAddress,
      signedStateHubToRecipient,
      paymentArgs
    )
    
    // mark the payment as redeemed by updating the recipient field
    await this.paymentMetaDao.redeemLinkedPayment(user, secret)
    // add the redemption update id
    await this.paymentsDao.addLinkedPaymentRedemption(payment.id, disbursement.id)

    const redeemedPaymentRow = await this.paymentMetaDao.getLinkedPayment(secret)
    purchaseId = redeemedPaymentRow.purchaseId
    amount = redeemedPaymentRow.amount

    return {
      error: false,
      res: { purchaseId, amount, } // will be null if fails
    }
  }

  public async doPurchaseById(id: string): Promise<PurchaseRowWithPayments> {
    const payments = await this.paymentMetaDao.byPurchase(id)
    if (!payments.length)
      return

    const totalAmount: Payment = {
      amountWei: '0',
      amountToken: '0',
    }
    for (let payment of payments) {
      totalAmount.amountWei = toBN(totalAmount.amountWei).add(
        toBN(payment.amount.amountWei)
      ).toString()
      totalAmount.amountToken = toBN(totalAmount.amountToken).add(
        toBN(payment.amount.amountToken)
      ).toString()
    }

    // TODO: this is a bit of a hack because we aren't totally tracking
    // purchases right now. In the future the `payments[0]` bits will be
    // replaced with an actual payments row.
    return {
      purchaseId: id,
      createdOn: payments[0].createdOn,
      sender: payments[0].sender,
      meta: { todo: 'this will be filled in later' },
      amount: totalAmount,
      payments,
    }
  }

  public async doChannelInstantPayment(payment: PurchasePayment, paymentId: number, updateId: number): Promise<number> {
    const paymentUpdate = payment.update as UpdateRequest

    const recipientChannel = await this.channelsDao.getChannelByUser(payment.recipient)
    if (!recipientChannel) {
      throw new Error(`Hub to recipient channel does not exist, cannot forward payment, payment: ${prettySafeJson(payment)}`)
    }

    const paymentArgs = paymentUpdate.args as PaymentArgs
    if (paymentArgs.recipient !== 'hub') {
      throw new Error(`Payment must be signed to hub in order to forward, payment: ${prettySafeJson(payment)}`)
    }

    // Create the payment that will be sent to the recipient. It's identical to
    // the payment being made to the hub, except:
    // 1) it will be sent to to the recipient's channel, and
    // 2) the recipient is the user, not the hub
    const argsHubToRecipient = {...paymentArgs, recipient: 'user'} as PaymentArgs

    const unsignedStateHubToRecipient = this.validator.generateChannelPayment(
      connext.convert.ChannelState('str', recipientChannel.state),
      argsHubToRecipient
    )
    const signedStateHubToRecipient = await this.signerService.signChannelState(unsignedStateHubToRecipient)
    const disbursement = await this.channelsDao.applyUpdateByUser(
      payment.recipient,
      'Payment',
      this.config.hotWalletAddress,
      signedStateHubToRecipient,
      argsHubToRecipient
    )

    // Link the payment (ie, the Payment row which references the
    // paying-user -> hub state update) to the disbursement.
    const channelInstantPaymentId = await this.paymentsDao.createChannelInstantPayment(paymentId, disbursement.id, updateId)
    return channelInstantPaymentId
  }

  private generatePurchaseId(
    prefix = '',
    len = 10,
    alphabet = null,
  ): string {
    let text = ''
    let possible =
      alphabet || 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

    for (let i = 0; i < len; i++)
      text += possible.charAt(Math.floor(Math.random() * possible.length))

    return prefix + text
  }
}
