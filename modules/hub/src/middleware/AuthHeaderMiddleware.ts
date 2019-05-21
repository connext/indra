import { ethers as eth } from 'ethers'
import * as express from 'express'

import log from '../util/log'

const { arrayify, isHexString, toUtf8Bytes, verifyMessage } = eth.utils
const LOG = log('AuthHeaderMiddleware')

export default class AuthHeaderMiddleware {
  public middleware(req: express.Request, res: express.Response, next: () => void): void {
    const address = req.get('x-address')
    const nonce = req.get('x-nonce')
    const signature = req.get('x-signature')
    req.session = {} as any
    if (!address || !nonce || !signature) {
      LOG.warn(`Missing auth headers: address="${address}" nonce="${nonce}" sig="${signature}"`)
      next()
      return
    }
    const bytes = isHexString(nonce) ? arrayify(nonce) : toUtf8Bytes(nonce)
    const signer = verifyMessage(bytes, signature).toLowerCase()
    if (signer !== address.toLowerCase()) {
      LOG.warn(`Invalid signature for nonce "${nonce}": Got "${signer}", expected "${address}"`)
      next()
      return
    }
    // We only set req.session.address after this address's
    // signature has been validated. If it's set, then auth was successful
    // This is made explict by the AuthHandler later in the express pipeline
    req.session.id = nonce
    req.session.address = signer
    next()
    return
  }
}
