import * as express from 'express'

import { ApiService } from './ApiService'

import ExchangeRateDao from '../dao/ExchangeRateDao'
import log from '../util/log'

const LOG = log('ExchangeRateApiService')

export default class ExchangeRateApiService extends ApiService<
  ExchangeRateApiServiceHandler
> {
  namespace = 'exchangeRate'
  routes = {
    'GET /': 'doRate',
  }
  handler = ExchangeRateApiServiceHandler
  dependencies = {
    dao: 'ExchangeRateDao',
  }
}

class ExchangeRateApiServiceHandler {
  dao: ExchangeRateDao

  async doRate (req: express.Request, res: express.Response) {
    try {
      const rate = await this.dao.latest()
      res.send(rate)
    } catch (err) {
      LOG.error('Failed to fetch latest exchange rate: {err}', {
        err
      })
      res.sendStatus(500)
    }
  }
}
