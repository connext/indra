import { ethers as eth } from 'ethers'
import * as express from 'express'
import { promisify } from 'util'

import Config from '../Config'
import { getRedisClient } from '../RedisClient'
import { Role } from '../Role'
import { RouteBasedACL } from '../RouteBasedAcl'
import { isValidHex, Logger } from '../util'

const { arrayify, isHexString, toUtf8Bytes, verifyMessage } = eth.utils

const nonceExpiry = 1000 * 60 * 60 * 2 // 2 hours

const defaultAcl: RouteBasedACL = new RouteBasedACL()
    .addRoute('/branding', Role.NONE)
    .addRoute('/config', Role.NONE)
    .addRoute('/exchangeRate', Role.NONE)
    .addRoute('/featureFlags', Role.NONE)
    .addRoute('/gasPrice/(.*)', Role.NONE)
    .addRoute('/nonce', Role.NONE)

export type AuthMiddleware = (req: express.Request, res: express.Response, next: () => void) =>
  Promise<void>

export const getAuthMiddleware = (
  config: Partial<Config>,
  acl: RouteBasedACL = defaultAcl,
): AuthMiddleware => async (
  req: express.Request, res: express.Response, next: () => void,
): Promise<void> => {

  const log = new Logger('AuthHeaderMiddleware', config.logLevel)
  const address = req.get('x-address')
  const nonce = req.get('x-nonce')
  const signature = req.get('x-signature')
  const authorization = req.get('authorization')

  req.address = address
  req.roles = []

  // Skip auth checks if requesting unpermissioned route
  if (acl.permissionForRoute(req.path) === Role.NONE) {
    log.debug(`Route ${req.path} doesn't require any permissions, skipping authentication`)
    next()
    return
  }

  // Check whether we should auth service key against bearer authorization header
  if (config.serviceKey && authorization) {
    const authHeaderParts = authorization.split(' ')
    if (authHeaderParts.length !== 2 || authHeaderParts[0].toLowerCase() !== 'bearer') {
      log.warn(`Malformed bearer authorization header`)
      res.status(403).send(`Malformed bearer authorization header`)
      return
    }

    const serviceKey = authHeaderParts[1]
    if (config.serviceKey === serviceKey) {
      req.roles.push(Role.AUTHENTICATED)
      req.roles.push(Role.SERVICE)
      log.info(`Successfully authenticated service key for user ${address}`)
    } else {
      log.warn(`Service key provided by ${address} doesn't match the one set in hub config`)
      res.status(403).send(`Invalid service key`)
      return
    }

  // Check whether we should auth via signature verification headers
  } else if (isValidHex(address, 20) && isValidHex(nonce, 32) && isValidHex(signature, 65)) {
    const redis = await getRedisClient(config.redisUrl)

    try {
      // TODO: Why aren't redis errors hitting the catch block?!
      const expectedNonce = await redis.get(`nonce:${address}`)
      if (!expectedNonce) {
        log.warn(`No nonce available for address ${address}`)
        res.status(403).send(`Invalid nonce`)
        redis.quit()
        return
      }
      if (expectedNonce !== nonce) {
        log.warn(`Invalid nonce for address ${address}: Got ${nonce}, expected ${expectedNonce}`)
        res.status(403).send(`Invalid nonce`)
        redis.quit()
        return
      }
      // check whether this nonce has expired
      const nonceTimestamp = (await redis.get(`nonce-timestamp:${address}`)) || '0'
      const nonceAge = Date.now() - parseInt(nonceTimestamp, 10)
      log.debug(`Nonce for ${address} was created ${nonceAge} ms ago`)
      if (nonceAge > nonceExpiry) {
        log.warn(`Invalid nonce for ${address}: expired ${nonceAge - nonceExpiry} ms ago`)
        res.status(403).send(`Invalid nonce`)
        redis.quit()
        return
      }
    } catch (e) {
      log.warn(`Not connected to redis ${config.redisUrl}`)
      res.status(500).send(`Server Error`)
      return
    }

    // Have we cached the verification for this signature?
    const cachedSig = await redis.get(`signature:${address}`)
    if (!cachedSig) {
      const bytes = isHexString(nonce) ? arrayify(nonce) : toUtf8Bytes(nonce)
      const signer = verifyMessage(bytes, signature).toLowerCase()
      if (signer !== address.toLowerCase()) {
        log.warn(`Invalid signature for nonce "${nonce}": Got "${signer}", expected "${address}"`)
        res.status(403).send('Invalid signature')
        redis.quit()
        return
      }
      await redis.set(`signature:${address}`, signature)
      redis.quit()
    } else if (cachedSig && cachedSig !== signature) {
      log.warn(`Invalid signature for address "${address}": Doesn't match cache: ${cachedSig}`)
      res.status(403).send('Invalid signature')
      redis.quit()
      return
    }

    req.roles.push(Role.AUTHENTICATED)
    log.debug(`Successfully authenticated signature for ${address}`)

  } else {
    log.warn(`Invalid auth headers: address=${address} nonce=${nonce} sig=${signature}`)
    res.status(403).send(`Invalid auth headers`)
    return
  }

  // Check if we should also assign an admin role
  if (config.adminAddresses.indexOf(address) > -1) {
    req.roles.push(Role.ADMIN)
    log.info(`Admin role added for user ${address}`)
  }

  // Given the set roles, do we have permission to access this route?
  const perm = acl.permissionForRoute(req.path)
  if (req.roles.indexOf(perm) === -1) {
    const roleStrings = JSON.stringify(req.roles.map((role: number): string => Role[role]))
    log.warn(`${address} ${roleStrings} is missing ${Role[perm]} role for route ${req.path}`)
    res.status(403).send(`You don't have the required role: ${Role[perm]}`)
    return
  }

  next()
  return
}
