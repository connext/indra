import { assert } from 'chai'
import { ethers as eth } from 'ethers'
import * as express from 'express'

import { Config } from '../Config'
import { getRedisClient } from '../RedisClient'
import { Role } from '../Role'
import { RouteBasedACL } from '../RouteBasedAcl'
import { getTestConfig } from '../testing/mocks'

import { AuthMiddleware, getAuthMiddleware } from './AuthMiddleware'

////////////////////////////////////////
// Define helpful constants

const { arrayify, bigNumberify, toUtf8Bytes } = eth.utils

const logLevel = 10
const forbidden = 403
const nonce = '7c965885-407a-4637-95cb-797dd9a8d8a2'
const serviceKey = 'unspank the unbanked'
const Two = eth.constants.Two
const wallet = eth.Wallet.createRandom()
const address = wallet.address.toLowerCase()
const config = getTestConfig()

const testAcl: RouteBasedACL = new RouteBasedACL()
  .addRoute('/none', Role.NONE)
  .addRoute('/authenticated', Role.AUTHENTICATED)
  .addRoute('/admin', Role.ADMIN)
  .addRoute('/service', Role.SERVICE)

const res: any = {
  sendStatus(status: number): void {
    this.sentStatus = status
  },
  status(status: number): any {
    this.sentStatus = status
    return { send: (): void => {/* noop */} }
  },
  sentStatus: 0,
}

////////////////////////////////////////
// Define helpful functions

const increment = (hex: string): string =>
  bigNumberify(hex).add(eth.constants.Two).toHexString()

const next = (): void => undefined

const getReq = (path: string, headers: object | undefined = undefined): any => ({
  get: (name: string): string => headers ? headers[name] : undefined,
  path,
})

const testAuthMiddleware = async (req: any, adminAddresses: string[] = []): Promise<void> =>
  getAuthMiddleware(
    getTestConfig({ adminAddresses, serviceKey }), testAcl, logLevel,
  )(req, res, next)

const assertRoles = (req: any, roles: number[]): void => {
  assert(
    req.roles.length === roles.length, `Expected ${roles.length} roles, got ${req.roles.length}`,
  )
  const roleStrings = JSON.stringify(req.roles.map((role: number): string => Role[role]))
  for (const role of roles) {
    assert(req.roles.indexOf(role) !== -1, `Expected ${roleStrings} to contain role ${Role[role]}`)
  }
}

const assertSentStatus = (status: number): void =>
  status === 0
  ? assert(res.sentStatus === status, `Expected no response sent, got ${res.sentStatus}`)
  : assert(res.sentStatus === status, `Expected to send status ${status}, got ${res.sentStatus}`)

////////////////////////////////////////
// Run tests

describe('AuthMiddleware', async () => {

  let sigHeaders
  let serviceHeaders
  before(async () => {
    sigHeaders = {
      'x-address': address,
      'x-nonce': nonce,
      'x-signature': await wallet.signMessage(toUtf8Bytes(nonce)),
    }
    serviceHeaders = {
      'x-service-key': serviceKey,
    }
    const redis = await getRedisClient(config.redisUrl)
    await redis.set(`nonce:${address}`, nonce)
  })

  beforeEach(() => res.status(0))

  it('should not set any roles if requesting a public route', async () => {
    let req
    req = getReq('/none', sigHeaders)
    await testAuthMiddleware(req)
    assertRoles(req, [])
    assertSentStatus(0)
    req = getReq('/none', serviceHeaders)
    await testAuthMiddleware(req)
    assertRoles(req, [])
    assertSentStatus(0)
  })

  it('should set an AUTHENTICATED role if given a valid signature', async () => {
    const req = getReq('/authenticated', sigHeaders)
    await testAuthMiddleware(req)
    assertRoles(req, [Role.AUTHENTICATED])
    assertSentStatus(0)
  })

  it('should set both AUTHENTICATED and ADMIN roles if the user is an admin', async () => {
    const req = getReq('/admin', sigHeaders)
    await testAuthMiddleware(req, [ address ])
    assertRoles(req, [Role.AUTHENTICATED, Role.ADMIN])
    assertSentStatus(0)
  })

  it('should set both AUTHENTICATED and SERVICE roles if the user is service user', async () => {
    const req = getReq('/service', serviceHeaders)
    await testAuthMiddleware(req)
    assertRoles(req, [Role.AUTHENTICATED, Role.SERVICE])
    assertSentStatus(0)
  })

  it('should deny access if no headers are provided', async () => {
    const req = getReq('/authenticated')
    await testAuthMiddleware(req)
    assertRoles(req, [])
    assertSentStatus(forbidden)
  })

  it('should deny access if given an invalid nonce', async () => {
    const req = getReq('/authenticated', {
      'x-address': address,
      'x-nonce': `${nonce} oops`,
      'x-signature': await wallet.signMessage(toUtf8Bytes(`${nonce} oops`)),
    })
    await testAuthMiddleware(req)
    assertRoles(req, [])
    assertSentStatus(forbidden)
  })

  it('should deny access if given an invalid signature', async () => {
    const req = getReq('/authenticated', {
      ...sigHeaders,
      'x-signature': increment(sigHeaders['x-signature']),
    })
    await testAuthMiddleware(req)
    assertRoles(req, [])
    assertSentStatus(forbidden)
  })

  it('should deny access to service routes if given an invalid service key', async () => {
    const req = getReq('/service', { 'x-service-key': `${serviceKey} oops` })
    await testAuthMiddleware(req)
    assertRoles(req, [])
    assertSentStatus(forbidden)
  })

  it('should deny access to admin routes if user is not an admin', async () => {
    const req = getReq('/admin', sigHeaders)
    await testAuthMiddleware(req, [ increment(address) ])
    assertRoles(req, [Role.AUTHENTICATED])
    assertSentStatus(forbidden)
  })

  it('should deny access if SERVICE user tries to access admin route', async () => {
    const req = getReq('/admin', serviceHeaders)
    await testAuthMiddleware(req)
    assertRoles(req, [Role.AUTHENTICATED, Role.SERVICE])
    assertSentStatus(forbidden)
  })

  it('should deny access if ADMIN user tries to access service route', async () => {
    const req = getReq('/service', sigHeaders)
    await testAuthMiddleware(req, [ address ])
    assertRoles(req, [Role.AUTHENTICATED, Role.ADMIN])
    assertSentStatus(forbidden)
  })

})
