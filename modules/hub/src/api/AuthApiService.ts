import { ethers as eth } from 'ethers'
import * as express from 'express'

import Config from '../Config'
import { RedisClient } from '../RedisClient'
import { isValidHex, Logger } from '../util'

import { ApiService } from './ApiService'

const getLog = (config: Config): Logger => new Logger('AuthApiService', config.logLevel)

export default class AuthApiService extends ApiService<AuthApiServiceHandler> {
  public namespace: string = 'nonce'
  public routes: any = {
    'GET /': 'doNonce',
  }
  public handler: any = AuthApiServiceHandler
  public dependencies: any = {
    config: 'Config',
    redis: 'RedisClient',
  }
}

class AuthApiServiceHandler {
  private redis: RedisClient
  private config: Config

  public async doNonce(req: express.Request, res: express.Response): Promise<express.Response> {
    if (!isValidHex(req.address, 20)) {
      return res.status(400).send('Invalid address in "x-address" header')
    }
    const nonce = eth.utils.hexlify(eth.utils.randomBytes(32))
    await this.redis.set(`nonce:${req.address}`, nonce)
    await this.redis.set(`nonce-timestamp:${req.address}`, Date.now().toString())
    await this.redis.del(`signature:${req.address}`)
    getLog(this.config).info(`Set nonce ${nonce} for address ${req.address}`)
    getLog(this.config).debug(`Saving challenge nonce for address ${req.address}: ${nonce}`)
    return res.send({ nonce })
  }

}
