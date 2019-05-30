import * as express from 'express'

import { Config } from '../Config'
import ExchangeRateDao from '../dao/ExchangeRateDao'
import { Logger } from '../util'

import { ApiService } from './ApiService'

const getLog = (config: Config): Logger => new Logger('ExchangeRateApiService', config.logLevel)

export default class ExchangeRateApiService extends ApiService<
  ExchangeRateApiServiceHandler
> {
  public namespace: string = 'exchangeRate'
  public routes: any = {
    'GET /': 'doRate',
  }
  public handler: any = ExchangeRateApiServiceHandler
  public dependencies: any = {
    config: 'Config',
    dao: 'ExchangeRateDao',
  }
}

class ExchangeRateApiServiceHandler {
  private dao: ExchangeRateDao
  private config: Config

  public async doRate (req: express.Request, res: express.Response): Promise<any> {
    try {
      const rate = await this.dao.latest()
      getLog(this.config).info(`Returning exchange rate: ${JSON.stringify(rate)}`)
      res.send(rate)
    } catch (err) {
      getLog(this.config).error(`Failed to fetch latest exchange rate: ${err}`)
      res.sendStatus(500)
    }
  }
}
