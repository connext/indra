import { Config } from '../Config'
import GasEstimateDao from '../dao/GasEstimateDao'
import { Logger } from '../util'

import { ApiService, Request, Response } from './ApiService'

const getLog = (config: Config): Logger => new Logger('GasEstimateApiService', config.logLevel)

export default class GasEstimateApiService extends ApiService<GasEstimateApiHandler> {
  public namespace: string = 'gasPrice'
  public routes: any = {
    'GET /estimate': 'doEstimate',
  }
  public dependencies: any = {
    config: 'Config',
    dao: 'GasEstimateDao',
  }
  public handler: any = GasEstimateApiHandler
}

class GasEstimateApiHandler {
  private dao: GasEstimateDao
  private config: Config

  public async doEstimate(req: Request, res: Response): Promise<void> {
    try {
      const latest = await this.dao.latest()
      res.send({
        gasPrice: latest ? latest.fast : undefined,
      })
    } catch (err) {
      getLog(this.config).error(`Failed to fetch latest gas price: ${err}`)
      res.sendStatus(500)
    }
  }
}
