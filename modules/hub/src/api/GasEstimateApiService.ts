import { ApiService, Request, Response } from './ApiService'

import GasEstimateDao from '../dao/GasEstimateDao'
import log from '../util/log'

const LOG = log('GasEstimateApiService')

export default class GasEstimateApiService extends ApiService<GasEstimateApiHandler> {
  namespace = 'gasPrice'
  routes = {
    'GET /estimate': 'doEstimate',
  }

  dependencies = {
    'dao': 'GasEstimateDao',
  }

  handler = GasEstimateApiHandler
}


class GasEstimateApiHandler {
  dao: GasEstimateDao

  async doEstimate(req: Request, res: Response) {
    try {
      let latest = await this.dao.latest()
      res.send({
        gasPrice: latest ? latest.fast : null,
      })
    } catch (err) {
      LOG.error('Failed to fetch latest gas price: {err}', {
        err
      })
      res.sendStatus(500)
    }
  }
}
