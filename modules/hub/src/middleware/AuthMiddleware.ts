import { ethers as eth } from 'ethers'
import * as express from 'express'

import Config from '../Config'
import { Role } from '../Role'
import { RouteBasedACL } from '../RouteBasedAcl'
import { getLogger } from '../util/log'
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
  config: Partial<Config>,
  acl: RouteBasedACL = defaultAcl,
  logLevel: number | undefined = undefined,
): AuthMiddleware => (
  req: express.Request, res: express.Response, next: () => void,
): void => {

  const log = getLogger('AuthHeaderMiddleware', logLevel)

  req.roles = []

  // Skip auth checks if requesting unpermissioned route
  if (acl.permissionForRoute(req.path) === Role.NONE) {
    log.debug(`Route ${req.path} doesn't require any permissions, skipping authentication`)
    next()
    return
  }

  // Check for proper address authentication
  const address = req.get('x-address')
  const nonce = req.get('x-nonce')
  const signature = req.get('x-signature')
  const serviceKey = req.get('x-service-key')

  if (!address || !nonce || !signature) {
    log.warn(`Missing auth headers: address="${address}" nonce="${nonce}" sig="${signature}"`)
    res.sendStatus(403)
    return
  }

  // TODO: use redis to cache the message verification
  const bytes = isHexString(nonce) ? arrayify(nonce) : toUtf8Bytes(nonce)
  const signer = verifyMessage(bytes, signature).toLowerCase()
  if (signer !== address.toLowerCase()) {
    log.warn(`Invalid signature for nonce "${nonce}": Got "${signer}", expected "${address}"`)
    res.sendStatus(403)
    return
  }

  req.address = signer
  req.roles.push(Role.AUTHENTICATED)
  log.debug(`Successfully authenticated signature for ${req.address}`)

  // Check if we should assign service user role
  if (config.serviceUserKey && serviceKey) {
    if (config.serviceUserKey === serviceKey) {
      req.roles.push(Role.SERVICE)
      log.info(`Successfully authenticated service key for user ${req.address}`)
    } else {
      log.warn(`Service key provided by ${req.address} doesn't match the one set in hub config`)
    }
  }

  // Check if we should assign admin role
  if (config.adminAddresses.indexOf(req.address) > -1) {
    req.roles.push(Role.ADMIN)
    log.info(`Admin role added for user ${req.address}`)
  }

  const perm = acl.permissionForRoute(req.path)
  if (req.roles.indexOf(perm) === -1) {
    const roleStrings = JSON.stringify(req.roles.map((role: number): string => Role[role]))
    log.warn(`${req.address} ${roleStrings} is missing ${Role[perm]} role for route ${req.path}`)
    res.sendStatus(403)
    return
  }

  next()
  return
}
