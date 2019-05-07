import * as express from 'express';
import {Role} from '../Role'

export function ownedAddressOrAdmin(req: express.Request) {
  const targetAddr = req.params.address
  const requesterAddr = req.session!.address
  const roles = req.session!.roles

  if (roles.has(Role.ADMIN)) {
    return true
  }

  return targetAddr === requesterAddr
}

export function isAdmin(req: express.Request) {
  const roles = req.session!.roles

  return roles.has(Role.ADMIN)
}