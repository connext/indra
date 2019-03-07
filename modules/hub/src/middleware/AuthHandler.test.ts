import * as express from 'express';
import {default as AuthHandler, DefaultAuthHandler} from './AuthHandler'
import Config from '../Config'
import {Role} from '../Role'
import {assert} from 'chai'

describe('AuthHandler', () => {
  let handler: AuthHandler

  beforeEach(() => {
    handler = new DefaultAuthHandler({
      adminAddresses: ['0xhonk', '0xbeep'],
      serviceUserKey: 'falafel'
    } as Config)
  });

  describe('#rolesFor', () => {
    it('should return a NONE role if the user is not a service user or logged in', async () => {
      const roles = await handler.rolesFor(fakeReq(null, null,))
      assert.deepEqual(roles, [Role.NONE])
    })

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
  })
})


function fakeReq (authHeader: string|null, session: any): express.Request {
  return {
    get: (name: string) => {
      return name === 'Authorization' ? authHeader : null
    },
    session
  } as express.Request
}
