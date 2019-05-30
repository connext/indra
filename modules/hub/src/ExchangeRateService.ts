import * as WebSocket from 'ws'

import { Config } from './Config'
import ExchangeRateDao from './dao/ExchangeRateDao'
import { SubscriptionServer } from './SubscriptionServer'
import { Logger } from './util'

interface RateResponse {
  data: { rates: { [k: string]: string } }
}

export default class ExchangeRateService {
  public static fetch: any = fetch
  private static POLL_INTERVAL_MS: number = 60000
  private static COINBASE_URL: string = 'https://api.coinbase.com/v2/exchange-rates?currency=ETH'
  private config: Config
  private dao: ExchangeRateDao
  private started: boolean = false
  private subscriptions: SubscriptionServer
  private log: Logger

  public constructor (config: Config, dao: ExchangeRateDao, subscriptions: SubscriptionServer) {
    this.config = config
    this.dao = dao
    this.subscriptions = subscriptions
    this.log = new Logger('ExchangeRateService', this.config.logLevel)
  }

  public start(): void {
    this.log.info('Starting exchange rate polling service.')
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

    this.log.debug('Fetching latest exchange rate.')

    ExchangeRateService.fetch(ExchangeRateService.COINBASE_URL)
      .then((res: Response) => res.json())
      .then((res: RateResponse) => {
        this.subscriptions.broadcast(JSON.stringify({
          'data': res.data.rates.USD,
          'type': 'ExchangeRate',
        }))
        this.dao.record(Date.now(), res.data.rates.USD)
      }).catch((e: any) => {
        this.log.error(`Couldn't connect to coinbase, failed to update ETH exchange rate.`)
        this.log.debug(e.message)
      })
      .then(() => setTimeout(() => this.updateRates(), ExchangeRateService.POLL_INTERVAL_MS))
  }
}
