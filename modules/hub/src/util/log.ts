import getLogger, {SCLogger} from './logging'
import * as express from 'express'

export default function log(namespace: string): SCLogger {
  return getLogger('payment-hub', namespace)
}

export function logApiRequestError(LOG: SCLogger, req: express.Request) {
  LOG.warn(
    'Received invalid request parameters. Aborting. Params received: {params}, Body received: {body}, Query received: {query}',
    {
      params: JSON.stringify(req.params),
      body: JSON.stringify(req.body),
      query: JSON.stringify(req.query)
    },
  )
}