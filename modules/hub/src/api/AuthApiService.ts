import { ApiService } from './ApiService'
import * as express from 'express'
import CRAuthManager from '../CRAuthManager'
import log from '../util/log'
import Config from '../Config'

const LOG = log('AuthApiService')

export default class AuthApiService extends ApiService<AuthApiServiceHandler> {
  namespace = 'auth'
  routes = {
    'POST /challenge': 'doChallenge',
    'POST /response': 'doResponse',
    'POST /status': 'doStatus',
    'GET /status': 'doStatus',
  }
  handler = AuthApiServiceHandler
  dependencies = {
    'crManager': 'CRAuthManager',
    'config': 'Config',
  }
}


class AuthApiServiceHandler {
  crManager: CRAuthManager

  config: Config

  async doChallenge(req: express.Request, res: express.Response) {
    const nonce = await this.crManager.generateNonce()

    LOG.debug(`Sending challenge nonce.`)

    res.send({
      nonce,
    })
  }

  async doResponse(req: express.Request, res: express.Response) {
    const address = req.body.address
    const nonce = req.body.nonce
    const origin = req.body.origin
    const signature = req.body.signature

    if (!address || !nonce || !origin || !signature) {
      LOG.warn('Received invalid challenge request. Aborting. Body received: {body}', {
        body: req.body,
      })
      return res.sendStatus(400)
    }

    let result: string|null

    try {
      result = await this.crManager.checkSignature(address, nonce, origin, signature)
    } catch (err) {
      LOG.error('Caught error checking signature: {err}', {
        err,
      })
      return res.sendStatus(400)
    }

    if (!result) {
      LOG.warn('Received invalid challenge response. Aborting.')
      return res.sendStatus(400)
    }

    req.session!.regenerate(async (err) => {
      if (err) {
        LOG.error('Caught error while regenerating session: {err}', {
          err,
        })
        return res.sendStatus(500)
      }

      req.session!.address = result
      res.send({ token: req.session!.id })
    })
  }

  doStatus(req: express.Request, res: express.Response) {
    if (req.session && req.session.address) {
      return res.send({
        success: true,
        address: req.session.address,
      })
    }

    LOG.info('No session found. Returning unsuccessful auth status.')

    return res.send({
      success: false,
    })
  }

}
