import { assert } from 'chai'
import {RouteBasedACL} from './RouteBasedAcl'
import {Role} from './Role'

describe('RouteBasedACL', () => {
  let acl: RouteBasedACL

  beforeEach(() => {
    acl = new RouteBasedACL(Role.AUTHENTICATED)
    acl.addRoute('/honk/:beep', Role.ADMIN)
      .addRoute('/foo', Role.NONE)
      .addRoute('/bar/abc-(\\d+)', Role.NONE)
  })

  it('should use the default perm for unmatched routes', () => {
    assert.strictEqual(acl.permissionForRoute('/nope'), Role.AUTHENTICATED)
  })

  it('should match named params', () => {
    assert.strictEqual(acl.permissionForRoute('/honk/foo'), Role.ADMIN)
  })

  it('should match exact routes', () => {
    assert.strictEqual(acl.permissionForRoute('/foo'), Role.NONE)
  })

  it('should match fuzzy routes', () => {
    assert.strictEqual(acl.permissionForRoute('/bar/abc-123'), Role.NONE)
  })
})
