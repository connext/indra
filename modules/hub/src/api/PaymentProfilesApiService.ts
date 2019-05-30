import * as express from 'express'
import { isArray } from 'util'

import { Config } from '../Config'
import PaymentProfilesService from '../PaymentProfilesService'
import { logApiRequestError, Logger, toBN } from '../util'
import { isServiceOrAdmin, isServiceOrAdminOrOwnedAddress } from '../util/ownedAddressOrAdmin'

import { ApiService } from './ApiService'

const getLog = (config: Config): Logger => new Logger('PaymentProfilesApiService', config.logLevel)

export default class PaymentProfilesApiService extends ApiService<
  PaymentProfilesApiServiceHandler
> {
  public namespace: string = 'profile'
  public routes: any = {
    'GET /:id': 'doGetPaymentProfileById',
    'GET /user/:user': 'doGetPaymentProfileByUser',
    'POST /': 'doCreatePaymentProfile',
    'POST /add-profile/:key': 'doAddProfileKey',
  }
  public handler: any = PaymentProfilesApiServiceHandler
  public dependencies: any = {
    config: 'Config',
    paymentProfilesService: 'PaymentProfilesService',
  }
}

class PaymentProfilesApiServiceHandler {
  public paymentProfilesService: PaymentProfilesService
  private config: Config

  public async doAddProfileKey(req: express.Request, res: express.Response): Promise<any> {
    if (!isServiceOrAdmin(req)) {
      res.status(403)
      return res.send({ error: 'Admin role not detected on request.' })
    }

    const { key } = req.params
    const { addresses } = req.body
    if (
      !key ||
      !Number.isInteger(parseInt(key, 10)) ||
      !addresses ||
      !isArray(addresses)
    ) {
      logApiRequestError(getLog(this.config), req)
      return res.sendStatus(400)
    }

    await this.paymentProfilesService.doAddProfileKey(parseInt(key, 10), addresses)
    return res.sendStatus(200)
  }

  public async doCreatePaymentProfile(req: express.Request, res: express.Response): Promise<any> {
    if (!isServiceOrAdmin(req)) {
      res.status(403)
      return res.send({ error: 'Admin role not detected on request.' })
    }

    const {
      minimumMaintainedCollateralWei,
      minimumMaintainedCollateralToken,
      amountToCollateralizeWei,
      amountToCollateralizeToken,
    } = req.body

    // TODO: right now the hub does not maintain collateral for wei
    // Do not error if these parameters are not detected
    // Do error if the parameters are non-zero
    if (
      // !minimumMaintainedCollateralWei ||
      !minimumMaintainedCollateralToken ||
      // !amountToCollateralizeWei ||
      !amountToCollateralizeToken
    ) {
      logApiRequestError(getLog(this.config), req)
      return res.sendStatus(400)
    }

    if (
      (minimumMaintainedCollateralWei &&
        !toBN(minimumMaintainedCollateralWei).isZero()) ||
      (amountToCollateralizeWei && !toBN(amountToCollateralizeWei).isZero())
    ) {
      logApiRequestError(getLog(this.config), req)
      return res.sendStatus(400)
    }

    const config = await this.paymentProfilesService.doCreatePaymentProfile({
      amountToCollateralizeToken,
      amountToCollateralizeWei,
      minimumMaintainedCollateralToken,
      minimumMaintainedCollateralWei,
    })

    return res.send({ paymentProfileId: config.id })
  }

  public async doGetPaymentProfileById(req: express.Request, res: express.Response): Promise<any> {
    if (!isServiceOrAdmin(req)) {
      res.status(403)
      return res.send({ error: 'Admin role not detected on request.' })
    }

    const { id } = req.params

    if (!id || !Number.isInteger(parseInt(id, 10))) {
      logApiRequestError(getLog(this.config), req)
      return res.sendStatus(400)
    }

    const config = await this.paymentProfilesService.doGetPaymentProfileById(
      parseInt(id, 10),
    )

    if (!config) {
      res.status(400)
      return res.send({ error: `No payment profile config found with id: ${id}` })
    }

    return res.send(config)
  }

  public async doGetPaymentProfileByUser(
    req: express.Request, res: express.Response,
  ): Promise<any> {
    if (!isServiceOrAdminOrOwnedAddress(req)) {
      logApiRequestError(getLog(this.config), req)
      return res.sendStatus(400)
    }
    const { user } = req.params

    if (!user) {
      logApiRequestError(getLog(this.config), req)
      return res.sendStatus(400)
    }

    const config = await this.paymentProfilesService.doGetPaymentProfileByUser(
      user,
    )

    if (!config) {
      res.status(400)
      return res.send({ error: `No payment profile config found for user: ${user}` })
    }

    return res.send(config)
  }
}
