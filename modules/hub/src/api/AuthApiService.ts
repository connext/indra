import { ethers as eth } from 'ethers'
import * as express from 'express'

import Config from '../Config'
import { RedisClient } from '../RedisClient'
import log, { logApiRequestError } from '../util/log'

import { ApiService } from './ApiService'

const LOG = log('AuthApiService')

export default class AuthApiService extends ApiService<AuthApiServiceHandler> {
  public namespace: string = 'auth'
  public routes: any = {
    'GET /': 'doNonce',
  }
  public handler: any = AuthApiServiceHandler
  public dependencies: any = {
    redis: 'RedisClient',
  }
}

class AuthApiServiceHandler {
  private redis: RedisClient
  private nonces: { [s: string]: number } = {}

  public async doNonce(req: express.Request, res: express.Response): Promise<express.Response> {
    const nonce = eth.utils.hexlify(eth.utils.randomBytes(32))
    await this.redis.set(`nonce:${req.address}`, nonce)
    await this.redis.set(`nonce-timestamp:${req.address}`, Date.now().toString())
    LOG.debug(`Saving challenge nonce for address ${req.address}: ${nonce}`)
    return res.send({ nonce })
  }

}
