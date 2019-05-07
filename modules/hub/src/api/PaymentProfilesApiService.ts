import { ApiService, } from './ApiService'
import * as express from 'express'
import log from '../util/log'
import Config from '../Config'

const LOG = log('ConfigApiService')

export default class ConfigApiService extends ApiService<ConfigApiServiceHandler> {
  namespace = 'profile'
  routes = {
    'POST /': 'doGetConfig',
  }
  handler = ConfigApiServiceHandler
  dependencies = {
    'config': 'Config',
  }
}

class ConfigApiServiceHandler {
  config: Config

  doAddProfileKey(req: express.Request, res: express.Response) {
    const { key } = req.params
    if (!key) {
      LOG.warn(
        'Received invalid payment request. Aborting. Params received: {params}, Body received: {body}',
        {
          params: JSON.stringify(req.params),
          body: JSON.stringify(req.body),
        },
      )
      return res.sendStatus(400)
    }
  }

}
