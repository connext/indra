import { Big } from "../util/bigNumber";
import DBEngine from '../DBEngine'
import * as express from 'express'
import { ApiService, Router } from './ApiService'
import { PaymentHandler } from '../PaymentHandler'
import log from '../util/log'
import { ownedAddressOrAdmin } from '../util/ownedAddressOrAdmin'
import { PaymentMetaDao } from '../dao/PaymentMetaDao'
import { WithdrawalDto } from '../domain/PaymentMeta'
import { Role } from '../Role'
import LedgerChannelsService from '../LedgerChannelService'
import VirtualChannelsService from '../VirtualChannelsService'
import { BigNumber } from 'bignumber.js'
import WithdrawalsService from '../WithdrawalsService'
import { LcStateUpdate, LedgerChannel } from '../domain/LedgerChannel'
import { VcStateUpdate } from '../domain/VirtualChannel'
import LedgerChannelService from '../LedgerChannelService'
import ExchangeRateDao from '../dao/ExchangeRateDao'
import { assertUnreachable } from '../util/assertUnreachable'
import { Payment, Purchase, PurchasePayment } from '../vendor/connext/types'
import { default as ThreadsService } from "../ThreadsService";
import { default as ChannelsService } from "../ChannelsService";
import { threadStateStrToBigNum } from "../domain/Thread";
import { default as Config } from "../Config";
import { PurchaseRowWithPayments } from "../domain/Purchase";

const LOG = log('PaymentsApiService')

function p<T, K extends keyof T>(host: T, attr: K, ...args: any[]): any {
  return new Promise((res, rej) => {
    ;(host as any)[attr](...args, (e: any, r: any) => (e ? rej(e) : res(r)))
  })
}

function bn2str(bn: BigNumber) {
  if (!bn) return bn
  return bn.dividedBy('1e18').toFixed()
}

export function generatePurchaseId(
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

export type MaybeResult<T> = (
  { error: true; msg: string } |
  { error: false; res: T }
)

export default class PaymentsApiService extends ApiService<PaymentsApiServiceHandler> {
  namespace = 'payments'
  routes = {
    'POST /purchase': 'doPurchase',
    //'GET /booty-load-limit': 'doBootyLimit',
    //'GET /:token?': 'doByToken',
    'GET /purchase/:id': 'doPurchaseById',
    //'GET /type/:type/:id': 'doById',
    'GET /history/:address': 'doPaymentHistory',
    //'GET /types/:type': 'doPaymentHistoryByType',
  }
  handler = PaymentsApiServiceHandler
  dependencies = {
    'ledgerChannelsService': 'LedgerChannelsService',
    'virtualChannelsService': 'VirtualChannelsService',
    'paymentHandler': 'PaymentHandler',
    'paymentMetaDao': 'PaymentMetaDao',
    'withdrawalsService': 'WithdrawalsService',
    'exRateDao': 'ExchangeRateDao',
    'db': 'DBEngine',
    'config': 'Config',
    'channelService': 'ChannelsService',
    'threadService': 'ThreadsService'
  }

}

export class PaymentsApiServiceHandler {
  threadService: ThreadsService
  channelService: ChannelsService
  paymentHandler: PaymentHandler<any, any>
  paymentMetaDao: PaymentMetaDao
  withdrawalsService: WithdrawalsService
  exRateDao: ExchangeRateDao
  db: DBEngine
  config: Config

  async doPurchase(req: express.Request, res: express.Response) {
    const payments: PurchasePayment[] = req.body.payments

    if (!payments) {
      LOG.warn(
        'Received invalid payment request. Aborting. Body received: {body}',
        {
          body: req.body,
        },
      )
      return res.sendStatus(400)
    }

    // TODO: Put this in a transaction
    let result = await this._doPurchase(req.session!.address, payments)
    if (result.error) {
      LOG.warn(result.msg)
      return res.send(400).json(result.msg)
    }
    res.send((result as any).res)
  }

  async _doPurchase(user: string, payments: PurchasePayment[]): Promise<MaybeResult<{ purchaseId: string }>> {
    const purchaseId = generatePurchaseId()

    for (let payment of payments) {
      console.log('payment: ', payment);
      let row: { id: number }
      if (payment.type == 'PT_CHANNEL') {
        row = (await this.channelService.doUpdates(user, [payment.update]))[0]
      } else if (payment.type == 'PT_THREAD') {
        row = await this.threadService.update(
          user,
          payment.recipient,
          threadStateStrToBigNum(payment.update.state),
        )
      } else {
        assertUnreachable(payment, 'invalid payment type: ' + (payment as any).type)
      }

      await this.paymentMetaDao.save(purchaseId, row.id, payment)
    }

    return {
      error: false,
      res: { purchaseId }
    }
  }

  async doPaymentHistory(
    req: express.Request,
    res: express.Response,
  ) {
    const targetAddr = req.params.address
    const requesterAddr = req.session!.address

    if (!ownedAddressOrAdmin(req)) {
      LOG.info(
        'Blocked attempt to view received payments for {targetAddr} from {requesterAddr}',
        {
          targetAddr,
          requesterAddr,
        },
      )

      return res.sendStatus(403)
    }

    const history = await this.paymentMetaDao.historyByUser(targetAddr)
    res.send(history)
  }

  /*
  async updateChannelFromPayment(
    purchaseId: string,
    payment: Payments,
  ) {
    this.paymentHandler.validateMetaFromObject(payment.meta)
    const paymentDto: PaymentDto = payment.payment
    const {
      channelId,
      ethBalanceA,
      ethBalanceB,
      tokenBalanceA,
      tokenBalanceB,
      nonce,
      sig,
    } = paymentDto

    let update: LcStateUpdate | VcStateUpdate
    if (payment.type === PaymentType.Ledger) {
      update = await this.ledgerChannelsService.update(
        channelId,
        nonce,
        new BigNumber(ethBalanceA),
        new BigNumber(ethBalanceB),
        new BigNumber(tokenBalanceA),
        new BigNumber(tokenBalanceB),
        sig,
      )
    } else if (payment.type == PaymentType.Virtual) {
      update = await this.virtualChannelsService.update(channelId, {
        ethBalanceA: new BigNumber(ethBalanceA),
        ethBalanceB: new BigNumber(ethBalanceB),
        tokenBalanceA: new BigNumber(tokenBalanceA),
        tokenBalanceB: new BigNumber(tokenBalanceB),
        nonce,
        sigA: sig,
      })
    } else {
      return assertUnreachable(payment.type, 'Unexpected payment type')
    }

    const p: Payment = {
      channelId,
      meta: JSON.stringify(payment.meta),
      token: update.id,
      purchase: purchaseId,
    }
    await this.paymentHandler.storeMeta(payment.meta, payment.type, p)

    return update
  }

  async doById(req: express.Request, res: express.Response) {
    const { id, type } = req.params

    let tip

    try {
      tip = await this.paymentHandler.fetchPaymentByType(type.toUpperCase(), id)
    } catch (err) {
      LOG.error('Failed to fetch payment: {err}', {
        err,
      })
      return res.sendStatus(400)
    }

    const address = req.session!.address

    if (
      tip &&
      tip.sender !== address &&
      !req.session!.roles.has(Role.ADMIN) &&
      !req.session!.roles.has(Role.SERVICE)
    ) {
      LOG.error(
        'Received request to view payment {type}, {id} from non-admin or owning address {address}',
        {
          type,
          id,
          address,
        },
      )
      return res.sendStatus(403)
    }

    return res.send(tip)
  }
  */

  async doPurchaseById(req: express.Request, res: express.Response) {
    const { id } = req.params

    if (
      !req.session!.roles.has(Role.ADMIN) &&
      !req.session!.roles.has(Role.SERVICE)
    ) {
      const address = req.session!.address
      LOG.error(
        'Received request to view purcahse {id} from non-admin or owning address {address}', {
          id,
          address,
        },
      )
      return res.sendStatus(403)
    }

    const payments = await this.paymentMetaDao.byPurchase(id)
    if (!payments.length)
      return res.sendStatus(404)

    const totalAmount: Payment = {
      wei: '0',
      token: '0',
    }
    for (let payment of payments) {
      totalAmount.wei = Big(totalAmount.wei).add(payment.amount.wei).toFixed()
      totalAmount.token = Big(totalAmount.token).add(payment.amount.token).toFixed()
    }

    // TODO: this is a bit of a hack because we aren't totally tracking
    // purchases right now. In the future the `payments[0]` bits will be
    // replaced with an actual payments row.
    return res.send({
      purchaseId: id,
      createdOn: payments[0].createdOn,
      sender: payments[0].sender,
      meta: { todo: 'this will be filled in later' },
      amount: totalAmount,
      payments,
    } as PurchaseRowWithPayments)
  }

  /*
  async doByToken(req: express.Request, res: express.Response) {
    const token = req.params.token

    let tip

    try {
      tip = await this.paymentHandler.fetchPayment(token)
    } catch (err) {
      LOG.error('Failed to fetch payment: {err}', {
        err,
      })
      return res.sendStatus(500)
    }

    const address = req.session!.address

    if (
      tip.payment.sender !== address &&
      !req.session!.roles.has(Role.ADMIN) &&
      !req.session!.roles.has(Role.SERVICE)
    ) {
      LOG.error(
        'Received request to view payment {token} from non-admin or owning address {address}',
        {
          token,
          address,
        },
      )
      return res.sendStatus(403)
    }

    return res.send(tip)
  }

  async doBootyLimit(req: express.Request, res: express.Response) {
    const address = req.session!.address
    const bootyLimit = await this.getUserBootyLimit(address)
    const exchangeRateRes = await this.exRateDao.latest()
    return res.send({
      bootyLimit: bootyLimit.toFixed(),
      exchangeRate: exchangeRateRes,
    })
  }

  async getUserBootyLimit(address: string): Promise<BigNumber> {
    // Totally break all the layers of abstraction and do the query to figure
    // out how much booty a user can get here. Doing this because this function
    // will be temporary, and doing it here will make it easier to pull out
    // later.

    const bootySpent = new BigNumber(
      (await this.db.query(
        `
      WITH s AS (
        SELECT
          type,
          (
            CASE WHEN type = 'EXCHANGE' THEN amounttoken * -1
            ELSE amounttoken
            END
          ) AS amt
        FROM payments
        WHERE sender = $1
      )
      SELECT COALESCE(SUM(amt), 0) AS amount_spent
      FROM s
    `,
        [address],
      )).rows[0].amount_spent,
    )

    const maxAmount = new BigNumber('69').mul('1e18')
    const limit = BigNumber.min(
      BigNumber.max(maxAmount.sub(bootySpent), 0),
      maxAmount,
    )
    return limit.lessThan('1e18') ? maxAmount : limit
  }

  async doPaymentHistoryByType(
    req: express.Request,
    res: express.Response,
  ) {
    const requesterAddr = req.session!.address
    const type =
      req.params.type === 'tips'
        ? PurchaseMetaType.TIP
        : PurchaseMetaType.PURCHASE

    if (!req.session!.roles.has(Role.ADMIN)) {
      LOG.info(
        'Blocked attempt to view received payments for {requesterAddr}.  User is not an admin.',
        {
          requesterAddr,
        },
      )

      return res.sendStatus(403)
    }

    let history

    try {
      history = await this.paymentMetaDao.allByType(type)
    } catch (err) {
      LOG.error('Failed to fetch payment information: {err}', {
        err,
      })
      return res.sendStatus(403)
    }

    res.send(history)
  }
  */
}
