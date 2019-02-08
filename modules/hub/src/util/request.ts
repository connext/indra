import * as express from 'express'
import { Role } from '../Role'

export function getUserFromRequest(req: express.Request) {
  const { user } = req.params
  const hasAccess = (
    (user && user == req.session!.address) ||
    req.session!.roles.has(Role.ADMIN) ||
    req.session!.roles.has(Role.SERVICE)
  )

  if (!hasAccess) {
    throw new Error(
      `Current user '${req.session!.address}' with roles ` +
      `'${JSON.stringify(Array.from(req.session!.roles))}' is not ` +
      `authorized to act on behalf of requested user '${user}'.`
    )
  }
  return user
}

