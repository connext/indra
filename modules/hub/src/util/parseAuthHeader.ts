import * as express from 'express'

export function parseAuthHeader(req: express.Request): string|undefined {
  const authHeader = req.get('Authorization')

  if (!Boolean(authHeader)) {
    return undefined
  }

  const splits = authHeader.split(' ')

  if (splits[0].toLowerCase() !== 'bearer' || !Boolean(splits[1])) {
    return undefined
  }

  return splits[1]
}

export function parseAuthTokenHeader(req: express.Request): string|undefined {
  const authHeader = req.get('x-auth-token')

  if (!Boolean(authHeader)) {
    return undefined
  }

  const splits = authHeader.split(' ')

  if (splits[0].toLowerCase() !== 'bearer' || !Boolean(splits[1])) {
    return undefined
  }

  return splits[1]
}