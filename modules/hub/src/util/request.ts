import * as express from 'express'
import { Role } from '../Role'

export function getUserFromRequest(req: express.Request) {
  const { user } = req.params
  const hasAccess = (
    (user && user == req.address) ||
    req.roles.has(Role.ADMIN) ||
    req.roles.has(Role.SERVICE)
  )

  if (!hasAccess) {
    throw new Error(
      `Current user '${req.address}' with roles ` +
      `'${JSON.stringify(Array.from(req.roles))}' is not ` +
      `authorized to act on behalf of requested user '${user}'.`
    )
  }
  return user
}

