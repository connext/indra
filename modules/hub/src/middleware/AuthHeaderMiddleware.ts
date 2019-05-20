import { sign } from 'cookie-signature'
import * as express from 'express'

import log from '../util/log'
import { parseAuthHeader, parseAuthTokenHeader} from '../util/parseAuthHeader'

const LOG = log('AuthHeaderMiddleware')

export default class AuthHeaderMiddleware {
  public constructor(private readonly cookieName: string, private readonly cookieSecret: string) {
    // TODO: how to fix this lint issue
    this.middleware = this.middleware.bind(this)
  }

  public middleware(req: express.Request, res: express.Response, next: () => void): void {
    const bodyToken = req.body.authToken
    const headerToken = parseAuthHeader(req)
    const headerAuthToken = parseAuthTokenHeader(req)
    let token

    // First: check the header token, this is the most trustworthy token location
    

    // First: check the POST body, this is the most trustworthy token location
    if (bodyToken) {
      token = bodyToken
      LOG.debug(`Found token in body: ${token.substring(0,8)}..`)

    // Second: check the header for Auth fields
    } else if (headerToken) {
      token = headerToken
      LOG.debug(`Found token in header: ${token.substring(0,8)}..`)

    // If we didn't find a token, too bad so sad
    } else {
      LOG.debug(`No token found`)
      next()
      return
    }

    // If we DID find a token, copy it into a cookie
    const cookie = `${this.cookieName}=s:${sign(token, this.cookieSecret)}`
    req.headers.cookie = cookie
    LOG.debug(`Stuffing header/body token into a cookie`)
    next()
  }
}
