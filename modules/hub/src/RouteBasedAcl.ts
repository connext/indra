import * as pathToRegexp from 'path-to-regexp'
import {Role} from './Role'

interface FuzzyRoute {
  regexp: RegExp,
  permission: Role
}

export class RouteBasedACL {
  private exactRoutes: { [k: string]: Role } = {}

  private fuzzyRoutes: FuzzyRoute[] = []

  private defaultPermission: Role

  constructor(defaultPermission?: Role) {
    this.defaultPermission = defaultPermission || Role.AUTHENTICATED
  }

  public addRoute(route: string, permission: Role): RouteBasedACL {
    this.exactRoutes[route] = permission
    this.fuzzyRoutes.push({
      regexp: pathToRegexp(route),
      permission,
    })
    return this
  }

  public permissionForRoute(path: string): Role {
    if (this.exactRoutes[path]) {
      return this.exactRoutes[path]
    }

    for (let route of this.fuzzyRoutes) {
      if (route.regexp.exec(path)) {
        return route.permission
      }
    }

    return this.defaultPermission
  }
}
