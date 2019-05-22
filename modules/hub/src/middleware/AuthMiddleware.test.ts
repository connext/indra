import {assert} from 'chai'
import * as express from 'express'

import { Config } from '../Config'
import { Role } from '../Role'
import { RouteBasedACL } from '../RouteBasedAcl'

import { AuthMiddleware, getAuthMiddleware } from './AuthMiddleware'

const testAcl: RouteBasedACL = new RouteBasedACL()
    .addRoute('/none', Role.NONE)
    .addRoute('/authenticated', Role.AUTHENTICATED)
    .addRoute('/admin', Role.ADMIN)
    .addRoute('/service', Role.SERVICE)

describe.only('AuthHandler', () => {
  const fakeRes: any = { sendStatus: (status: number): void => undefined }
  const fakeNext = (): void => undefined
  const getFakeReq = (path: string, headers: object | undefined = undefined): any => ({
    get: (name: string): string => headers ? headers[name] : undefined,
    path,
  })

  const testAuthMiddleware = (req: any): void => getAuthMiddleware({
    adminAddresses: ['0xhonk', '0xbeep'],
    serviceUserKey: 'falafel',
  }, testAcl, false)(req, fakeRes, fakeNext)


  it.only('should not set any roles if no headers are provided', async () => {
    const fakeReq = getFakeReq('/authenticated')
    testAuthMiddleware(fakeReq)
    assert(fakeReq.roles.length === 0, `Expected roles length to be 0, got ${fakeReq.roles.length}`)
  })
/*
  it('should return AUTHENTICATED if the user is authed but not an admin', async () => {
    const roles = await handler.rolesFor(fakeReq(null, {
      address: '0xtoot'
    }))
    assert.deepEqual(roles, [Role.AUTHENTICATED])
  })

  it('should return both AUTHENTICATED and ADMIN roles if the user is authed and an admin', async () => {
    const roles = await handler.rolesFor(fakeReq(null, {
      address: '0xbeep'
    }))
    assert.deepEqual(roles, [Role.AUTHENTICATED, Role.ADMIN])
  })

  it('should return both AUTHENTICATED and SERVICE roles if the user is a service user', async () => {
    const roles = await handler.rolesFor(fakeReq('Bearer falafel', null))
    assert.deepEqual(roles, [Role.AUTHENTICATED, Role.SERVICE])
  })

  it('should return NONE if the service user key is wrong', async () => {
    const roles = await handler.rolesFor(fakeReq('Bearer notright', null))
    assert.deepEqual(roles, [Role.NONE])
  })
*/

})
