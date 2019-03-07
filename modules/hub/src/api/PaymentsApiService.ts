import { Big } from "../util/bigNumber";
import DBEngine from '../DBEngine'
import * as express from 'express'
import { ApiService } from './ApiService'
import log from '../util/log'
import { ownedAddressOrAdmin } from '../util/ownedAddressOrAdmin'
import { PaymentMetaDao } from '../dao/PaymentMetaDao'
import { Role } from '../Role'
import WithdrawalsService from '../WithdrawalsService'
import ExchangeRateDao from '../dao/ExchangeRateDao'
import { Payment, PurchasePayment, UpdateRequest } from '../vendor/connext/types'
import { default as ThreadsService } from "../ThreadsService";
import { default as ChannelsService } from "../ChannelsService";
import { default as Config } from "../Config";
import { PurchaseRowWithPayments } from "../domain/Purchase";
import PaymentsService from "../PaymentsService";

const LOG = log('PaymentsApiService')

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
    'paymentMetaDao': 'PaymentMetaDao',
    'exRateDao': 'ExchangeRateDao',
    'db': 'DBEngine',
    'config': 'Config',
    'paymentsService': 'PaymentsService',
    'channelService': 'ChannelsService',
    'threadService': 'ThreadsService'
  }

}

export class PaymentsApiServiceHandler {
  paymentsService: PaymentsService
  threadService: ThreadsService
  channelService: ChannelsService
  paymentMetaDao: PaymentMetaDao
  withdrawalsService: WithdrawalsService
  exRateDao: ExchangeRateDao
  db: DBEngine
  config: Config

  async doPurchase(req: express.Request, res: express.Response) {
    const payments: PurchasePayment[] = req.body.payments
    const meta: any = req.body.meta

    if (!payments || !meta) {
      LOG.warn(
        'Received invalid payment request. Aborting. Params received: {params}, Body received: {body}',
        {
          params: JSON.stringify(req.params),
          body: JSON.stringify(req.body),
        },
      )
      return res.sendStatus(400)
    }

    const result = await this.paymentsService.doPurchase(req.session!.address, meta, payments)
    if (result.error != false) {
      LOG.warn(result.msg)
      return res.send(400).json(result.msg)
    }

    const lastChanTx = Math.min(...payments.map(p => (p.update as UpdateRequest).txCount)) - 1
    const updates = await this.channelService.getChannelAndThreadUpdatesForSync(
      req.session!.address,
      lastChanTx,
      0,
    )

    res.send({
      purchaseId: result.res.purchaseId,
      sync: updates,
    })
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

  async doPurchaseById(req: express.Request, res: express.Response) {
    const { id } = req.params

    if (
      !req.session!.roles.has(Role.ADMIN) &&
      !req.session!.roles.has(Role.SERVICE)
    ) {
      const address = req.session!.address
      LOG.error(
        'Received request to view purchase {id} from non-admin or owning address {address}', {
          id,
          address,
        },
      )
      return res.sendStatus(403)
    }

    const purchase = await this.paymentsService.doPurchaseById(id)
    if (!purchase) {
      return res.sendStatus(404)
    }

    res.send(purchase)
  }
}
