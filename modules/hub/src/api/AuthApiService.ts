import * as express from 'express'

import Config from '../Config'
import CRAuthManager from '../CRAuthManager'
import { RedisClient } from '../RedisClient'
import log from '../util/log'

import { ApiService } from './ApiService'

const LOG = log('AuthApiService')

export default class AuthApiService extends ApiService<AuthApiServiceHandler> {
  namespace = 'auth'
  routes = {
    'POST /challenge': 'doChallenge',
    'POST /response': 'doResponse',
    'POST /status': 'doStatus',
    'GET /status': 'doStatus'
  }
  handler = AuthApiServiceHandler
  dependencies = {
    config: 'Config',
    crManager: 'CRAuthManager',
    redis: 'RedisClient'
  }
}

class AuthApiServiceHandler {
  public crManager: CRAuthManager

  public config: Config

  public redis: RedisClient

  public async doChallenge(req: express.Request, res: express.Response) {
    const nonce = await this.crManager.generateNonce()

    LOG.debug(`Sending challenge nonce.`)

    res.send({
      nonce
    })
  }

  // TODO: This endpoing will probably be entirely removed under new auth schema
  public async doResponse(req: express.Request, res: express.Response) {
    const address = req.body.address
    const nonce = req.body.nonce
    const origin = req.body.origin
    const signature = req.body.signature

    if (!address || !nonce || !origin || !signature) {
      LOG.warn(
        `Received invalid challenge request. Aborting. Body received: ${
          JSON.stringify(req.body)}`)
      return res.sendStatus(400)
    }

    let result: string | null

    try {
      result = await this.crManager.checkSignature(
        address,
        nonce,
        origin,
        signature
      )
    } catch (err) {
      LOG.error(`Caught error checking signature: ${err}`)
      return res.sendStatus(400)
    }

    if (!result) {
      LOG.warn('Received invalid challenge response. Aborting.')
      return res.sendStatus(400)
    }

    await this.redis.save()

    /*
    req.session!.regenerate(async err => {
      if (err) {
        LOG.error(`Caught error while regenerating session: ${err}`)
        return res.sendStatus(500)
      }

      req.session!.address = result
      res.send({ token: req.session!.id })
    })
    */
  }

  doStatus(req: express.Request, res: express.Response) {
    if (req.session && req.session.address) {
      return res.send({
        success: true,
        address: req.session.address
      })
    }

    LOG.info('No session found. Returning unsuccessful auth status.')

    return res.send({
      success: false
    })
  }
}
