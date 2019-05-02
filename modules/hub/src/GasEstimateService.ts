import { Poller } from './Connext';
import GasEstimateDao from './dao/GasEstimateDao'
import log from './util/log'

const LOG = log('GasEstimateService')

export interface EthGasStationResponse {
  fast: number
  speed: number
  fastest: number
  avgWait: number
  fastWait: number
  blockNum: number
  safeLowWait: number
  block_time: number
  fastestWait: number
  safeLow: number
  average: number
}

export default class GasEstimateService {
  static POLL_INTERVAL_MS = 60 * 1000

  static MAX_GAS_PRICE = 100

  static ETHGASSTATION_URL = 'https://ethgasstation.info/json/ethgasAPI.json'

  static MAX_RETRY_COUNT = 5

  private poller: Poller

  constructor (
    private dao: GasEstimateDao,
  ) {
    this.poller = new Poller({
      name: 'GasEstimateService',
      interval: GasEstimateService.POLL_INTERVAL_MS,
      callback: this.pollGasEstimates.bind(this),
      timeout: 2 * 60 * 1000,
    })
  }

  public start() {
    LOG.info('Starting gas estimate service.')
    this.poller.start()
  }

  public stop() {
    this.poller.stop()
  }

  async pollGasEstimates() {
    for (let retryCount = 0; ; retryCount += 1) {
      try {
        await this.pollOnce()
      } catch (e) {
        if (retryCount >= GasEstimateService.MAX_RETRY_COUNT) {
          LOG.error('Fatal error on attempt {retryCount}/{maxRetryCount} to fetch gas prices: {e}', {
            retryCount,
            maxRetryCount: GasEstimateService.MAX_RETRY_COUNT,
            e,
          })
          break
        }

        const retryTimeout = Math.pow(3, retryCount)
        LOG.warn('Non-fatal error on attempt {retryCount}/{maxRetryCount} to fetch gas prices (retrying in {retryTimeout} seconds): {e}', {
          retryCount,
          maxRetryCount: GasEstimateService.MAX_RETRY_COUNT,
          retryTimeout: retryTimeout,
          e,
        })
        await new Promise(res => setTimeout(res, retryTimeout * 1000))
        continue
      }

      break
    }
  }

  async pollOnce() {
    LOG.debug('Fetching latest gas estimate...')

    let res: EthGasStationResponse = await (await fetch(GasEstimateService.ETHGASSTATION_URL)).json()

    await this.dao.record({
      retrievedAt: Date.now(),
      speed: res.speed,
      blockNum: res.blockNum,
      blockTime: res.block_time,

      fastest: this.normalizePrice(res.fastest),
      fastestWait: res.fastestWait,

      fast: this.normalizePrice(res.fast),
      fastWait: res.fastWait,

      average: this.normalizePrice(res.average),
      avgWait: res.avgWait,

      safeLow: this.normalizePrice(res.safeLow),
      safeLowWait: res.safeLowWait,
    })

  }

  private normalizePrice(price: number): number {
    return Math.min(Math.ceil(price / 10), GasEstimateService.MAX_GAS_PRICE)
  }
}
