import { default as DBEngine } from './DBEngine'
import { PaymentMetaDao } from "./dao/PaymentMetaDao";
import { PurchasePayment, convertThreadState, UpdateRequest, UpdateRequestBigNumber, PaymentArgs, convertPayment, PaymentArgsBigNumber, convertChannelState, PaymentArgsBN, ChannelStateUpdate, PurchasePaymentSummary } from "./vendor/connext/types";
import { assertUnreachable } from "./util/assertUnreachable";
import ChannelsService from "./ChannelsService";
import ThreadsService from "./ThreadsService";
import ChannelsDao from "./dao/ChannelsDao";
import Config from "./Config";
import { prettySafeJson } from "./util";
import { Big } from "./util/bigNumber";
import { StateGenerator } from "./vendor/connext/StateGenerator";
import { Validator } from "./vendor/connext/validator";
import { SignerService } from "./SignerService";
import { sign } from "cookie-signature";
import PaymentsDao from "./dao/PaymentsDao";

type MaybeResult<T> = (
  { error: true; msg: string } |
  { error: false; res: T }
)

export default class PaymentsService {
  private channelsService: ChannelsService
  private threadsService: ThreadsService
  private signerService: SignerService
  private paymentsDao: PaymentsDao
  private paymentMetaDao: PaymentMetaDao
  private channelsDao: ChannelsDao
  private validator: Validator
  private config: Config
  private db: DBEngine

  constructor(
    channelsService: ChannelsService,
    threadsService: ThreadsService,
    signerService: SignerService,
    paymentsDao: PaymentsDao,
    paymentMetaDao: PaymentMetaDao,
    channelsDao: ChannelsDao,
    validator: Validator,
    config: Config,
    db: DBEngine,
  ) {
    this.channelsService = channelsService
    this.threadsService = threadsService
    this.signerService = signerService
    this.paymentsDao = paymentsDao
    this.paymentMetaDao = paymentMetaDao
    this.channelsDao = channelsDao
    this.validator = validator
    this.config = config
    this.db = db
  }

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

    for (let payment of payments) {
      let row: { id?: number }
      if (payment.type == 'PT_CHANNEL') {
        let channelUpdateRequest: UpdateRequestBigNumber

        if (payment.recipient !== this.config.hotWalletAddress) {
          // instant custodial payment, forward payment to recipient
          // TODO: db transaction @wolever
          await this.doInstantCustodialPayment(user, payment, purchaseId)
          // all database txs are handled by the above function, so just continue
          continue
        } else {
          // normal payment
          // TODO: should we check if recipient == hub here?
          channelUpdateRequest = {
            args: payment.update.args,
            reason: 'Payment',
            sigUser: payment.update.sigUser,
            txCount: payment.update.txCount
          }
          const updates = await this.channelsService.doUpdates(user, [channelUpdateRequest])
          row = updates[0]
        }
      } else if (payment.type == 'PT_THREAD') {
        row = await this.threadsService.update(
          user,
          payment.recipient,
          convertThreadState('bignumber', payment.update.state),
        )
      } else {
        assertUnreachable(payment, 'invalid payment type: ' + (payment as any).type)
      }

      // Note: this handling of meta isn't ideal. In the future, we should have
      // a Purchase table to store the purchase metadata instead of merging it
      // into payment metadata.
      await this.paymentMetaDao.save(purchaseId, row.id, {
        recipient: payment.recipient,
        amount: payment.amount,
        type: payment.type,
        meta: {
          ...meta,
          ...payment.meta,
        },
      })
    }

    return {
      error: false,
      res: { purchaseId }
    }
  }

  private async doInstantCustodialPayment(user: string, payment: PurchasePayment, purchaseId: string): Promise<number> {
    const paymentUpdate = payment.update as UpdateRequest

    const recipientChannel = await this.channelsDao.getChannelByUser(payment.recipient)
    if (!recipientChannel) {
      throw new Error(`Hub to recipient channel does not exist, cannot forward payment, payment: ${prettySafeJson(payment)}`)
    }

    const paymentArgs = paymentUpdate.args as PaymentArgs
    if (paymentArgs.recipient !== 'hub') {
      throw new Error(`Payment must be signed to hub in order to forward, payment: ${prettySafeJson(payment)}`)
    }

    // save recipient update
    // same payment args, but specify as hub to user
    const argsHubToRecipient =
      { ...paymentUpdate.args, recipient: 'user' } as PaymentArgs

    const unsignedStateHubToRecipient = this.validator.generateChannelPayment(
      convertChannelState('str', recipientChannel.state),
      argsHubToRecipient,
    )
    const signedStateHubToRecipient = await this.signerService.signChannelState(unsignedStateHubToRecipient)
    const disbursement = await this.channelsDao.applyUpdateByUser(
      payment.recipient,
      'Payment',
      this.config.hotWalletAddress,
      signedStateHubToRecipient,
      argsHubToRecipient
    )

    // return user to hub update request to be sent to hub through doUpdate
    const channelUpdateRequest: UpdateRequestBigNumber = {
      args: convertPayment('bignumber', paymentUpdate.args as PaymentArgsBN),
      reason: 'Payment',
      txCount: paymentUpdate.txCount,
      sigUser: paymentUpdate.sigUser
    }

    const updates = await this.channelsService.doUpdates(user, [channelUpdateRequest])
    const { id: updateId } = updates[0]
    const paymentId = await this.paymentMetaDao.save(purchaseId, updateId, payment)
    return await this.paymentsDao.create(paymentId, disbursement.id)
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
