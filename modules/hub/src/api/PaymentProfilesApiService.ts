import { ApiService, } from './ApiService'
import * as express from 'express'
import log from '../util/log'
import Config from '../Config'

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
      LOG.warn(
        'Received invalid profile key request. Aborting. Params received: {params}, Body received: {body}',
        {
          params: JSON.stringify(req.params),
          body: JSON.stringify(req.body),
        },
      )
      return res.sendStatus(400)
    }
  }

}
