import log from "./util/log";
import { Poller } from "./vendor/connext/lib/poller/Poller";
import ChannelsDao from "./dao/ChannelsDao";
import DBEngine from "./DBEngine";
import { convertChannelState, convertPayment,  PaymentArgs } from "./vendor/connext/types";
import { CustodialPaymentsDao } from "./custodial-payments/CustodialPaymentsDao";
import OptimisticPaymentDao from "./dao/OptimisticPaymentDao";
import { OptimisticPurchasePaymentRow } from "./domain/OptimisticPayment";
import { SignerService } from "./SignerService";
import { Validator } from "./vendor/connext/validator";
import Config from "./Config";
import { prettySafeJson } from "./util";

const LOG = log('OptimisticPaymentsService')

const POLL_INTERVAL = 1000
const CUSTODIAL_PAYMENT_TIMER = 30 * 1000

export class OptimisticPaymentsService {
  private poller: Poller

  constructor(
    private config: Config,
    private db: DBEngine,
    private opPaymentDao: OptimisticPaymentDao,
    private custodialPaymentsDao: CustodialPaymentsDao,
    private channelsDao: ChannelsDao,
    private signerService: SignerService,
    private validator: Validator,
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

        // if the payment was created more than 30 seconds ago, 
        // send custodially
        if (CUSTODIAL_PAYMENT_TIMER < Date.now() - +p.createdOn) {
          await this.sendCustodialPayment(p)
          continue
        }

        // check if the payee channel has sufficient collateral
        const payeeState = convertChannelState("bignumber", payeeChan.state)
        const paymentBig = convertPayment("bignumber", p.amount)
        if (
          payeeState.balanceTokenHub.lt(paymentBig.amountToken) || payeeState.balanceWeiHub.lt(paymentBig.amountWei)
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
    try {
      const update = await this.channelsDao.getChannelUpdateById(payment.channelUpdateId)

      if ((update.args as PaymentArgs).recipient !== "hub") {
        throw new Error(`Payment must be signed to hub in order to forward, payment: ${prettySafeJson(payment)}`)
      }

      const payeeChan = await this.channelsDao.getChannelByUser(payment.recipient)

      const payeeArgs = { ...update.args, recipient: "user" } as PaymentArgs

      const unsignedStateHubToRecipient = this.validator.generateChannelPayment(
        convertChannelState('str', payeeChan.state),
        payeeArgs
      )

      const signedStateHubToRecipient = await this.signerService.signChannelState(unsignedStateHubToRecipient)

      const redemption = await this.channelsDao.applyUpdateByUser(
        payment.recipient,
        'Payment',
        this.config.hotWalletAddress,
        signedStateHubToRecipient,
        payeeArgs
      )

      await this.opPaymentDao.addOptimisticPaymentRedemption(payment.paymentId, redemption.id)
    } catch (e) {
      // if the custodial payment fails, the payment should fail
      LOG.info("Error redeeming optimistic channel payment. ID: {id}", {
        id: payment.paymentId,
      })
    }
    // TODO: recollateralization here?
  }

  private async sendCustodialPayment(payment: OptimisticPurchasePaymentRow): Promise<void> {
    try {
      const custodialId = await this.custodialPaymentsDao.createCustodialPayment(payment.paymentId, payment.channelUpdateId)
      await this.opPaymentDao.addOptimisticPaymentCustodial(payment.paymentId, custodialId)
    } catch (e) {
      // if the custodial payment fails, the payment should fail
      await this.revertPayment(payment)
    }
  }

  private async revertPayment(payment: OptimisticPurchasePaymentRow): Promise<void> {
    // TODO: how to handle this in the case of this being one failed
    // payment in a purchase? should all the payments that make up
    // that purchase be reverted?

    // mark the payment as failed
    await this.opPaymentDao.optimisticPaymentFailed(payment.paymentId)
  }
}