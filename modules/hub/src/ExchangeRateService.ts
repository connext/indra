import * as WebSocket from 'ws'

import ExchangeRateDao from './dao/ExchangeRateDao'
import { Logger } from './util'

const log = new Logger('ExchangeRateService')

interface RateResponse {
  data: { rates: { [k: string]: string } }
}

export default class ExchangeRateService {
  public static fetch: any = fetch
  private static POLL_INTERVAL_MS: number = 60000
  private static COINBASE_URL: string = 'https://api.coinbase.com/v2/exchange-rates?currency=ETH'
  private dao: ExchangeRateDao
  private started: boolean = false

  public constructor (dao: ExchangeRateDao) {
    this.dao = dao
  }

  public start(): void {
    log.info('Starting exchange rate polling service.')
    this.started = true
    this.updateRates()
  }

  public stop(): void {
    this.started = false
  }

  private updateRates(): void {
    if (!this.started) {
      return
    }

    log.debug('Fetching latest exchange rate.')

    ExchangeRateService.fetch(ExchangeRateService.COINBASE_URL)
      .then((res: Response) => res.json())
      .then((res: RateResponse) => {
        this.dao.record(Date.now(), res.data.rates.USD)
      }).catch((e: any) => log.error(`Failed to update ETH exchange rate: ${e}`))
      .then(() => setTimeout(() => this.updateRates(), ExchangeRateService.POLL_INTERVAL_MS))
  }
}
