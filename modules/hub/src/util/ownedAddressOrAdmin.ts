import * as express from 'express';
import {Role} from '../Role'

export function ownedAddressOrAdmin(req: express.Request) {
  const targetAddr = req.params.address || req.params.user
  const requesterAddr = req.session!.address

  if (isAdmin(req)) {
    return true
  }

  return targetAddr === requesterAddr
}

export function isAdmin(req: express.Request) {
  const roles = req.session!.roles

  return roles.has(Role.ADMIN)
}

export function isService(req: express.Request) {
  const roles = req.session!.roles

  return roles.has(Role.SERVICE)
}

export function isServiceOrAdmin(req: express.Request) {
  return isService(req) || isAdmin(req)
}

export function isServiceOrAdminOrOwnedAddress(req: express.Request) {
  return isService(req) || ownedAddressOrAdmin(req)
}