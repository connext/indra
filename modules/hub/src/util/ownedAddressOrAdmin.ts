import * as express from 'express'

import {Role} from '../Role'

export function ownedAddressOrAdmin(req: express.Request): boolean {
  const targetAddr = req.params.address || req.params.user
  const requesterAddr = req.address
  if (isAdmin(req)) return true
  return targetAddr === requesterAddr
}

export function isAdmin(req: express.Request): boolean {
  return req.roles.indexOf(Role.ADMIN) > -1
}

export function isService(req: express.Request): boolean {
  return req.roles.indexOf(Role.SERVICE) > -1
}

export function isServiceOrAdmin(req: express.Request): boolean {
  return isService(req) || isAdmin(req)
}

export function isServiceOrAdminOrOwnedAddress(req: express.Request): boolean {
  return isService(req) || ownedAddressOrAdmin(req)
}
