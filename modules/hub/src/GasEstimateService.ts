import * as connext from 'connext'

import { Config } from './Config'
import GasEstimateDao from './dao/GasEstimateDao'
import { SubscriptionServer } from './SubscriptionServer'
import { Logger } from './util'

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
  private static ETHGASSTATION_URL: string = 'https://ethgasstation.info/json/ethgasAPI.json'
  private static MAX_GAS_PRICE: number = 100

  public static MAX_RETRY_COUNT: number = 5
  public static POLL_INTERVAL_MS: number = 60 * 1000

  private config: Config
  private dao: GasEstimateDao
  private subscriptions: SubscriptionServer
  private log: Logger
  private poller: connext.Poller

  public constructor (config: Config, dao: GasEstimateDao, subscriptions: SubscriptionServer) {
    this.config = config
    this.dao = dao
    this.subscriptions = subscriptions
    this.log = new Logger('GasEstimateService', this.config.logLevel)
    this.poller = new connext.Poller({
      callback: this.pollGasEstimates.bind(this),
      interval: GasEstimateService.POLL_INTERVAL_MS,
      name: 'GasEstimateService',
      timeout: 2 * 60 * 1000,
      verbose: parseInt(this.config.logLevel.toString(), 10) > 2,
    })
  }

  public start(): void {
    this.log.info('Starting gas estimate service.')
    this.poller.start()
  }

  public stop(): void {
    this.poller.stop()
  }

  public async pollGasEstimates(): Promise<void> {
    for (let retryCount = 0; ; retryCount += 1) {
      try {
        await this.pollOnce()
      } catch (e) {
        if (retryCount >= GasEstimateService.MAX_RETRY_COUNT) {
          this.log.error(`Fatal error on attempt ` +
            `${retryCount}/${GasEstimateService.MAX_RETRY_COUNT} to fetch gas prices`)
          this.log.debug(e.message)
          break
        }

        const retryTimeout = Math.pow(3, retryCount)
        this.log.warn(`Non-fatal error on attempt ` +
          `${retryCount}/${GasEstimateService.MAX_RETRY_COUNT} to fetch gas prices ` +
          `(retrying in ${retryTimeout} seconds)`)
        this.log.debug(e.message)
        await new Promise((res: any): any => setTimeout(res, retryTimeout * 1000))
        continue
      }

      break
    }
  }

  public async pollOnce(): Promise<void> {
    this.log.debug('Fetching latest gas estimate...')

    const res: EthGasStationResponse = await (
      await fetch(GasEstimateService.ETHGASSTATION_URL)
    ).json()

    const fast: number = this.normalizePrice(res.fast)

    this.subscriptions.broadcast(JSON.stringify({
      'data': fast,
      'type': 'GasPrice',
    }))

    await this.dao.record({
      average: this.normalizePrice(res.average),
      avgWait: res.avgWait,
      blockNum: res.blockNum,
      blockTime: res.block_time,
      fast,
      fastest: this.normalizePrice(res.fastest),
      fastestWait: res.fastestWait,
      fastWait: res.fastWait,
      retrievedAt: Date.now(),
      safeLow: this.normalizePrice(res.safeLow),
      safeLowWait: res.safeLowWait,
      speed: res.speed,
    })

  }

  private normalizePrice(price: number): number {
    return Math.min(Math.ceil(price / 10), GasEstimateService.MAX_GAS_PRICE)
  }
}
