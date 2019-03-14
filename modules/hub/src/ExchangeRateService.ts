import ExchangeRateDao from './dao/ExchangeRateDao'
import log from './util/log'

const LOG = log('ExchangeRateService')

interface RateResponse {
  data: {
    rates: {
      [k: string]: string
    }
  }
}

export default class ExchangeRateService {
  static fetch = fetch

  private static POLL_INTERVAL_MS = 60000

  private static COINBASE_URL = 'https://api.coinbase.com/v2/exchange-rates?currency=ETH'

  private dao: ExchangeRateDao

  private started: boolean = false

  constructor (dao: ExchangeRateDao) {
    this.dao = dao
  }

  public start() {
    LOG.info('Starting exchange rate polling service.')
    this.started = true
    this.updateRates()
  }

  public stop() {
    this.started = false
  }

  private updateRates() {
    if (!this.started) {
      return
    }

    LOG.debug('Fetching latest exchange rate.')

    ExchangeRateService.fetch(ExchangeRateService.COINBASE_URL)
      .then((res: Response) => res.json())
      .then((res: RateResponse) => this.dao.record(Date.now(), res.data.rates.USD))
      .catch((e: any) => LOG.error('Failed to update ETH exchange rate: {e}', { e }))
      .then(() => setTimeout(() => this.updateRates(), ExchangeRateService.POLL_INTERVAL_MS))
  }
}
