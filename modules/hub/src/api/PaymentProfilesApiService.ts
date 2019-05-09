import { ApiService, } from './ApiService'
import * as express from 'express'
import log, { logApiRequestError } from '../util/log'
import { isAdmin } from '../util/ownedAddressOrAdmin';
import { isArray } from 'util';
import { big } from 'connext';
import PaymentProfilesService from '../PaymentProfilesService'

const { Big } = big

const LOG = log('PaymentProfilesApiService')

export default class PaymentProfilesApiService extends ApiService<PaymentProfilesApiServiceHandler> {
  namespace = 'profile'
  routes = {
    'POST /add-profile/:key': 'doAddProfileKey',
    'POST /': 'doCreatePaymentProfile',
    'GET /:id': 'doGetPaymentProfile'
  }
  handler = PaymentProfilesApiServiceHandler
  dependencies = {
    paymentProfilesService: 'PaymentProfilesService',
  } 
}

class PaymentProfilesApiServiceHandler {

  paymentProfilesService: PaymentProfilesService

  async doAddProfileKey(req: express.Request, res: express.Response) {
    if (!isAdmin(req)) {
      res.status(403)
      res.send({ error: "Admin role not detected on request." })
    }

    const { key } = req.params
    const { addresses } = req.body
    if (!key || !Number.isInteger(key) || !addresses || !isArray(addresses)) {
      logApiRequestError(LOG, req)
      return res.sendStatus(400)
    }

    const { paymentProfileId, addressesUpdated } = await this.paymentProfilesService.doAddProfileKey(key, addresses)
    return res.send({ paymentProfileId, addressesUpdated })
  }

  async doCreatePaymentProfile(req: express.Request, res: express.Response) {
    if (!isAdmin(req)) {
      res.status(403)
      res.send({ error: "Admin role not detected on request." })
    }

    const {
      minimumMaintainedCollateralWei, 
      minimumMaintainedCollateralToken, 
      amountToCollateralizeWei, 
      amountToCollateralizeToken
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
      logApiRequestError(LOG, req)
      return res.sendStatus(400)
    }

    if (
      minimumMaintainedCollateralWei && !Big(minimumMaintainedCollateralWei).isZero() ||
      amountToCollateralizeWei && !Big(amountToCollateralizeWei).isZero()
    ) {
      logApiRequestError(LOG, req)
      return res.sendStatus(400)
    }

    const config = await this.paymentProfilesService.doCreatePaymentProfile({
      minimumMaintainedCollateralWei, 
      minimumMaintainedCollateralToken, 
      amountToCollateralizeWei, 
      amountToCollateralizeToken
    })

    // TODO: return value here?
    return res.send({ paymentProfileId: config.id })
  }

  async doGetPaymentProfile(req: express.Request, res: express.Response) {
    if (!isAdmin(req)) {
      res.status(403)
      res.send({ error: "Admin role not detected on request." })
    }

    const { id } = req.params

    if (id || !Number.isInteger(id)) {
      logApiRequestError(LOG, req)
      return res.sendStatus(400)
    }

    const config = await this.paymentProfilesService.doGetPaymentProfileById(id)

    if (!config) {
      res.status(400)
      res.send({ error: `No payment profile config found with id: ${id}` })
    }

    return res.send(config)
  }

}
