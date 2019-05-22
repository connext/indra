import * as express from 'express'

import Config from '../Config'
import CRAuthManager from '../CRAuthManager'
import { RedisClient } from '../RedisClient'
import log, { logApiRequestError } from '../util/log'

import { ApiService } from './ApiService'

const LOG = log('AuthApiService')

export default class AuthApiService extends ApiService<AuthApiServiceHandler> {
  namespace = 'auth'
  routes = {
    'POST /challenge': 'doChallenge',
    'POST /response': 'doResponse',
    'GET /status/:user': 'doStatus',
  }
  handler = AuthApiServiceHandler
  dependencies = {
    config: 'Config',
    crManager: 'CRAuthManager',
    redis: 'RedisClient',
  }
}

class AuthApiServiceHandler {
  public crManager: CRAuthManager

  public config: Config

  private redis: RedisClient

  public async doChallenge(req: express.Request, res: express.Response): Promise<express.Response> {
    // save the nonce to redis, with the address
    // provided in the request body
    const { address } = req.body
    if (!address) {
      logApiRequestError(LOG, req)
      return res.sendStatus(400)
    }

    const nonce = await this.crManager.generateNonce()

    LOG.debug(`Saving challenge nonce for address ${address}: ${nonce}`)

    await this.redis.set(
      `AuthAddress:${address}`, 
      nonce
    )

    LOG.debug(`Sending challenge nonce.`)

    return res.send({
      nonce,
    })
  }

  private async getNonceFromRedis(address: string) {
    try {
      const nonce = await this.redis.get(`AuthorizedAddress:${address}`)
      return nonce
    } catch (e) {
      LOG.warn(`No nonce found in redis for address: ${address}`)
      return null
    }
  }

  // TODO: This endpoint will probably be entirely removed under new auth schema
  public async doResponse(
    req: express.Request,
    res: express.Response,
  ): Promise<express.Response> {
    const address = req.body.address
    const origin = req.body.origin
    const signature = req.body.signature

    if (!address || !origin || !signature) {
      LOG.warn(
        `Received invalid challenge request. Aborting. Body received: ${JSON.stringify(
          req.body,
        )}`,
      )
      return res.sendStatus(400)
    }

    const nonce = await this.getNonceFromRedis(address)

    if (!nonce) {
      LOG.warn(`No nonce found for address: ${address}`)
      return res.sendStatus(400)
    }

    let result: string | null

    try {
      result = await this.crManager.checkSignature(
        address,
        nonce,
        origin,
        signature,
      )
    } catch (err) {
      LOG.error(`Caught error checking signature: ${err}`)
      return res.sendStatus(400)
    }

    if (!result) {
      LOG.warn('Received invalid challenge response. Aborting.')
      return res.sendStatus(400)
    }

    res.send({
      address,
      nonce,
    })
  }

  public async doStatus(req: express.Request, res: express.Response) {
    const { address } = req.params

    if (!address) {
      logApiRequestError(LOG, req)
      return res.sendStatus(400)
    }

    const nonce = await this.getNonceFromRedis(address)
    if (nonce) {
      return res.send({
        address: req.session.address,
        nonce: req.session.nonce,
        success: true,
      })
    }

    LOG.info('No session found. Returning unsuccessful auth status.')

    return res.send({
      success: false,
    })
  }
}
