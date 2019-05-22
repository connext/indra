import * as express from 'express'

import Config from '../Config'
import CRAuthManager from '../CRAuthManager'
import { RedisClient } from '../RedisClient'
import log, { logApiRequestError } from '../util/log'

import { ApiService } from './ApiService'

const LOG = log('AuthApiService')

export default class AuthApiService extends ApiService<AuthApiServiceHandler> {
  public namespace: string = 'auth'
  public routes: any = {
    'GET /nonce/:user': 'doNonce',
  }
  public handler: any = AuthApiServiceHandler
  public dependencies: any = {
    config: 'Config',
    crManager: 'CRAuthManager',
    redis: 'RedisClient',
  }
}

class AuthApiServiceHandler {
  public crManager: CRAuthManager
  public config: Config
  private redis: RedisClient

  public async doNonce(req: express.Request, res: express.Response): Promise<express.Response> {
    // save the nonce to redis, with the addressprovided in the request params
    const { address } = req.params
    if (!address) {
      logApiRequestError(LOG, req)
      return res.sendStatus(400)
    }
    const nonce = await this.crManager.generateNonce()
    LOG.debug(`Saving challenge nonce for address ${address}: ${nonce}`)
    await this.redis.set(`nonce:${address}`, nonce)
    return res.send({
      nonce,
    })
  }

}
