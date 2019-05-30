import * as connext from 'connext'
import {
  PurchasePayment,
  UpdateRequest,
} from 'connext/types'
import * as express from 'express'

import { default as ChannelsService } from '../ChannelsService'
import { Config } from '../Config'
import ExchangeRateDao from '../dao/ExchangeRateDao'
import { PaymentMetaDao } from '../dao/PaymentMetaDao'
import PaymentsDao from '../dao/PaymentsDao'
import DBEngine from '../DBEngine'
import PaymentsService from '../PaymentsService'
import { Role } from '../Role'
import { default as ThreadsService } from '../ThreadsService'
import { logApiRequestError, Logger } from '../util'
import { ownedAddressOrAdmin } from '../util/ownedAddressOrAdmin'
import WithdrawalsService from '../WithdrawalsService'

import { ApiService } from './ApiService'

const getLog = (config: Config): Logger => new Logger('PaymentsApiService', config.logLevel)

export default class PaymentsApiService extends ApiService<PaymentsApiServiceHandler> {
  public namespace: string = 'payments'
  public routes: any = {
    'GET /history/:address': 'doPaymentHistory',
    'GET /purchase/:id': 'doPurchaseById',
    'POST /:user/email': 'doPaymentEmail',
    'POST /purchase': 'doPurchase',
    'POST /redeem/:user': 'doRedeem',
  }
  public handler: any = PaymentsApiServiceHandler
  public dependencies: any = {
    'channelService': 'ChannelsService',
    'config': 'Config',
    'db': 'DBEngine',
    'exRateDao': 'ExchangeRateDao',
    'paymentMetaDao': 'PaymentMetaDao',
    'paymentsDao': 'PaymentsDao',
    'paymentsService': 'PaymentsService',
    'threadService': 'ThreadsService',
  }
}

export class PaymentsApiServiceHandler {
  public paymentsService: PaymentsService
  public threadService: ThreadsService
  public channelService: ChannelsService
  public paymentMetaDao: PaymentMetaDao
  public paymentsDao: PaymentsDao
  public withdrawalsService: WithdrawalsService
  public exRateDao: ExchangeRateDao
  public db: DBEngine
  public config: Config

  public async doPurchase(req: express.Request, res: express.Response): Promise<any> {
    const payments: PurchasePayment[] = req.body.payments
    const meta: any = req.body.meta

    if (!payments || !meta) {
      getLog(this.config).warn(
        `Received invalid payment request. Aborting. Params received: ${JSON.stringify(req.params)}, Body received: ${JSON.stringify(req.body)}`)
      return res.sendStatus(400)
    }

    const result = await this.paymentsService.doPurchase(req.address, meta, payments)
    if (result.error != false) {
      getLog(this.config).warn(result.msg)
      return res.send(400).json(result.msg)
    }

    const lastChanTx = Math.min(...payments.map(p => (p.update as UpdateRequest).txCount).filter(f => typeof f === 'number')) - 1
    const updates = await this.channelService.getChannelAndThreadUpdatesForSync(
      req.address,
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
    const requesterAddr = req.address

    if (!ownedAddressOrAdmin(req)) {
      getLog(this.config).info(`Blocked attempt to view received payments for ${targetAddr} from ${requesterAddr}`)

      return res.sendStatus(403)
    }

    const history = await this.paymentMetaDao.historyByUser(targetAddr)
    res.send(history)
  }

  async doPaymentEmail(req: express.Request, res: express.Response) {
    const user = req.address
    const {
      subject,
      to,
      text
    } = req.body

    if (!subject || !to || !text || !user) {
      logApiRequestError(getLog(this.config), req)
      return res.sendStatus(400)
    }

    const result = await this.paymentsService.doPaymentEmail(
      user, to, subject, text,
    )

    if (result.error) {
      getLog(this.config).error(
        `Error trying to send email via mailgun for user ${user}. Error: ${result.error}`)
      return res.sendStatus(400)
    }

    return res.send((result as any).res)
  }

  async doPurchaseById(req: express.Request, res: express.Response) {
    const { id } = req.params

    if (
      !req.roles.has(Role.ADMIN) &&
      !req.roles.has(Role.SERVICE)
    ) {
      const address = req.address
      getLog(this.config).error(
        `Received request to view purchase ${id} from non-admin or owning address ${address}`)
      return res.sendStatus(403)
    }

    const purchase = await this.paymentsService.doPurchaseById(id)
    if (!purchase) {
      return res.sendStatus(404)
    }

    res.send(purchase)
  }

  async doRedeem(req: express.Request, res: express.Response) {
    const user = req.address
    const { secret, lastThreadUpdateId, lastChanTx } = req.body
    if (!user || !secret || !Number.isInteger(lastChanTx) || !Number.isInteger(lastThreadUpdateId)) {
      getLog(this.config).warn(`Received invalid update redeem request. Aborting. Body received: ${JSON.stringify(req.body)}, Params received: ${JSON.stringify(req.params)}`)
      return res.sendStatus(400)
    } 

    const result = await this.paymentsService.doRedeem(user, secret)
    if (result.error != false) {
      getLog(this.config).warn(result.msg)
      // @ts-ignore
      // TODO: wtf? it works, but doesnt compile
      // are the express types out of date somehow?
      return res.send(400, result.msg)
    }

    const updates = await this.channelService.getChannelAndThreadUpdatesForSync(
      req.address,
      lastChanTx,
      lastThreadUpdateId,
    )

    res.send({
      purchaseId: result.res.purchaseId,
      amount: result.res.amount,
      sync: updates,
    })
  }

}
