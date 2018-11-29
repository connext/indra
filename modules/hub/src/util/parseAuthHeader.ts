import * as express from 'express'

export default function parseAuthHeader(req: express.Request): string|null {
  const authHeader = req.get('Authorization')

  if (!authHeader) {
    return null
  }

  const splits = authHeader.split(' ')

  if (splits[0].toLowerCase() !== 'bearer' || !splits[1]) {
    return null
  }

  return splits[1]
}
