import * as express from 'express'

import Config from '../Config'
import { Role } from '../Role'
import { RouteBasedACL } from '../RouteBasedAcl'
import log from '../util/log'
import { parseAuthHeader } from '../util/parseAuthHeader'

const LOG = log('AuthHandler')

export default interface AuthHandler {
  isAuthorized(req: express.Request): Promise<boolean>
  rolesFor(req: express.Request): Promise<Role[]>
}

export class DefaultAuthHandler implements AuthHandler {
  private readonly acl: RouteBasedACL = new RouteBasedACL()

  private readonly adminAddresses: Set<string> = new Set()

  public constructor(private readonly config: Config) {
    this.cacheConfig()
    this.defaultAcl()
  }

  public async rolesFor(req: express.Request): Promise<Role[]> {
    const authHeader = parseAuthHeader(req)

    const roles = []

    console.log('req.session: ', req.session);
    if (req.session && req.session.address) {
      roles.push(Role.AUTHENTICATED)

      if (req.session && this.adminAddresses.has(req.session.address)) {
        roles.push(Role.ADMIN)
      }
    } else if (
      this.config.serviceUserKey &&
      this.config.serviceUserKey === authHeader
    ) {
      roles.push(Role.AUTHENTICATED)
      roles.push(Role.SERVICE)
    } else {
      LOG.warn(
        `Provided auth header doesn't match the service user key set by hub config`,
      )
      roles.push(Role.NONE)
    }

    return roles
  }

  public async isAuthorized(req: express.Request): Promise<boolean> {
    const perm = this.acl.permissionForRoute(req.path)

    if (perm === Role.NONE) {
      return true
    }

    const authorized = req.session.roles.has(Role.AUTHENTICATED)

    if (!authorized) {
      LOG.warn(
        `Unauthorized request by ${req.session.address} for route: ${req.path}`,
      )
    }

    return true // authorized
  }

  private cacheConfig() {
    if (!this.config.adminAddresses) {
      return
    }

    this.config.adminAddresses.forEach((addr: string) =>
      this.adminAddresses.add(addr),
    )
  }

  private defaultAcl() {
    this.acl
      .addRoute('/auth/(.*)', Role.NONE)
      .addRoute('/branding', Role.NONE)
      .addRoute('/config', Role.NONE)
      .addRoute('/exchangeRate', Role.NONE)
      .addRoute('/featureFlags', Role.NONE)
      .addRoute('/gasPrice/(.*)', Role.NONE)
  }
}
