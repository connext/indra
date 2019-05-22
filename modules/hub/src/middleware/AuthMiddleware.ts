import { ethers as eth } from 'ethers'
import * as express from 'express'

import Config from '../Config'
import { Role } from '../Role'
import { RouteBasedACL } from '../RouteBasedAcl'
import { getLogger, mockLogger } from '../util/log'
import { parseAuthHeader } from '../util/parseAuthHeader'

const { arrayify, isHexString, toUtf8Bytes, verifyMessage } = eth.utils
const defaultAcl: RouteBasedACL = new RouteBasedACL()
    .addRoute('/auth/(.*)', Role.NONE)
    .addRoute('/branding', Role.NONE)
    .addRoute('/config', Role.NONE)
    .addRoute('/exchangeRate', Role.NONE)
    .addRoute('/featureFlags', Role.NONE)
    .addRoute('/gasPrice/(.*)', Role.NONE)

export type AuthMiddleware = (req: express.Request, res: express.Response, next: () => void) => void

export const getAuthMiddleware = (
  config: Partial<Config>, acl: RouteBasedACL = defaultAcl, shouldLog: boolean = true,
): AuthMiddleware => (
  req: express.Request, res: express.Response, next: () => void,
): void => {

  const log = shouldLog ? getLogger('AuthHeaderMiddleware') : mockLogger

  req.roles = []

  // Skip auth checks if requesting unpermissioned route
  if (acl.permissionForRoute(req.path) === Role.NONE) {
    log.info(`Route ${req.path} doesn't require any permissions, skipping authentication`)
    next()
    return
  }

  ////////////////////////////////////////
  // Check if service user

  const authHeader = parseAuthHeader(req)

  if (config.serviceUserKey && authHeader) {
    if (config.serviceUserKey === authHeader) {
      req.roles.push(Role.AUTHENTICATED)
      req.roles.push(Role.SERVICE)
      log.info(`Successfully authenticated a service user`)
    } else {
      log.warn(`Provided auth header doesn't match the service user key set by hub config`)
    }
  }

  ////////////////////////////////////////
  // Check for nonce signature

  const address = req.get('x-address')
  const nonce = req.get('x-nonce')
  const signature = req.get('x-signature')

  // TODO: use redis to cache the message verification

  if (!address || !nonce || !signature) {
    log.warn(`Missing auth headers: address="${address}" nonce="${nonce}" sig="${signature}"`)
    res.sendStatus(403)
    return
  }

  const bytes = isHexString(nonce) ? arrayify(nonce) : toUtf8Bytes(nonce)
  const signer = verifyMessage(bytes, signature).toLowerCase()
  if (signer !== address.toLowerCase()) {
    log.warn(`Invalid signature for nonce "${nonce}": Got "${signer}", expected "${address}"`)
    res.sendStatus(403)
    return
  }

  req.address = signer
  req.roles.push(Role.AUTHENTICATED)
  log.info(`Successfully authenticated signature for ${req.address}`)

  ////////////////////////////////////////
  // Check if admin address

  if (config.adminAddresses.indexOf(req.address) > -1) {
    log.info(`Admin role added for user ${req.address}`)
    req.roles.push(Role.ADMIN)
  }

  next()
  return
}
