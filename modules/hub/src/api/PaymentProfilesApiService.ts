import { ApiService, } from './ApiService'
import * as express from 'express'
import log, { logApiRequestError } from '../util/log'

const LOG = log('PaymentProfilesApiService')

export default class PaymentProfilesApiService extends ApiService<PaymentProfilesApiServiceHandler> {
  namespace = 'profile'
  routes = {
    'POST /': 'doAddProfileKey',
  }
  handler = PaymentProfilesApiServiceHandler
  dependencies = {
  }
}

class PaymentProfilesApiServiceHandler {
  doAddProfileKey(req: express.Request, res: express.Response) {
    const { key } = req.params
    if (!key) {
      logApiRequestError(LOG, req)
      return res.sendStatus(400)
    }
  }

}
