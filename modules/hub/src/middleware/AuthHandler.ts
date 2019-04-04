import * as express from 'express'
import {RouteBasedACL} from '../RouteBasedAcl'
import log from '../util/log'
import Config from '../Config'
import {Role} from '../Role'
import parseAuthHeader from '../util/parseAuthHeader'

const LOG = log('AuthHandler')

export default interface AuthHandler {
  isAuthorized(req: express.Request): Promise<boolean>
  rolesFor(req: express.Request): Promise<Role[]>
}

export class DefaultAuthHandler implements AuthHandler {
  private acl: RouteBasedACL = new RouteBasedACL()

  private config: Config

  private adminAddresses: Set<string> = new Set()

  constructor(config: Config) {
    this.config = config

    this.cacheConfig()
    this.defaultAcl()
  }

  async rolesFor(req: express.Request): Promise<Role[]> {
    const authHeader = parseAuthHeader(req)

    const roles = []

    if (req.session && req.session.address) {
      roles.push(Role.AUTHENTICATED)

      if (req.session && this.adminAddresses.has(req.session!.address)) {
        roles.push(Role.ADMIN)
      }
    } else if (this.config.serviceUserKey && this.config.serviceUserKey === authHeader) {
      roles.push(Role.AUTHENTICATED)
      roles.push(Role.SERVICE)
    } else {
      roles.push(Role.NONE)
    }

    return roles
  }

  async isAuthorized(req: express.Request): Promise<boolean> {
    const perm = this.acl.permissionForRoute(req.path as string)

    if (perm === Role.NONE) {
      return true
    }

    const authorized = req.session!.roles.has(Role.AUTHENTICATED)

    if (!authorized) {
      LOG.warn('Unauthorized request for route: {path}', {
        path: req.path,
      })
    }

    return authorized
  }

  private cacheConfig() {
    if (!this.config.adminAddresses) {
      return
    }

    this.config.adminAddresses.forEach((addr: string) => this.adminAddresses.add(addr))
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
