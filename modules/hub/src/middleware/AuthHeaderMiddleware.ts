import * as express from 'express'
import { sign } from 'cookie-signature'
import parseAuthHeader from '../util/parseAuthHeader'
import log from '../util/log'

const LOG = log('AuthHeaderMiddleware')

export default class AuthHeaderMiddleware {
  private cookieName: string
  private cookieSecret: string

  constructor(cookieName: string, cookieSecret: string) {
    this.cookieName = cookieName
    this.cookieSecret = cookieSecret
    this.middleware = this.middleware.bind(this)
  }

  public middleware(req: express.Request, res: express.Response, next: () => void) {
    const bodyToken = req.body && req.body.authToken ? req.body.authToken : null
    const cookieToken = req.headers.cookie
    const headerToken = parseAuthHeader(req)
    let token

    // First: check the POST body, this is the most trustworthy token location
    if (bodyToken) {
      token = bodyToken
      LOG.debug(`Found token in body: ${token.substring(0,8)}..`)

    // Second: check the header for Auth fields
    } else if (headerToken) {
      token = headerToken
      LOG.debug(`Found token in header: ${token.substring(0,8)}..`)

    // Last: if we already have a cookie available, use it (blocked by many browsers tho)
    } else if (cookieToken) {
      LOG.debug(`Found token in cookie: ${cookieToken}`)
      return next() // skip last step

    // If we didn't find a token, too bad so sad
    } else {
      LOG.debug(`No token found`)
      return next()
    }

    // If we DID find a token, copy it into a cookie
    const cookie = `${this.cookieName}=s:${sign(token, this.cookieSecret)}`
    req.headers.cookie = cookie
    LOG.debug(`Stuffing header/body token into a cookie`)
    next()
  }
}
