import { CoinPaymentsService } from './CoinPaymentsService'
import { default as ChannelsDao } from '../dao/ChannelsDao'
import { Poller } from '../vendor/connext/lib/poller/Poller'
import { default as log } from '../util/log'
import { CoinPaymentsDao } from './CoinPaymentsDao'
import { default as ChannelsService } from '../ChannelsService'
import { hasPendingOps } from '../vendor/connext/hasPendingOps'
import { default as DBEngine } from '../DBEngine'
import { prettySafeJson } from '../util'
import { BigNumber } from 'bignumber.js/bignumber'
import { DepositArgs } from '../vendor/connext/types'
import { default as ExchangeRateDao } from '../dao/ExchangeRateDao'
import { default as Config } from '../Config'

const LOG = log('CoinPaymentsDepositPollingService')

export class CoinPaymentsDepositPollingService {
  private poller: Poller

  constructor(
    private config: Config,
    private db: DBEngine,
    private service: CoinPaymentsService,
    private dao: CoinPaymentsDao,
  ) {
    this.poller = new Poller({
      name: 'CoinPaymentsDepositPollingService',
      interval: 2 * 60 * 1000,
      callback: this.pollOnce.bind(this),
      timeout: 2 * 60 * 1000,
    })
  }

  async start() {
    LOG.info('Starting CoinPaymentsDepositPollingService...')
    this.poller.start()
  }

  async pollOnce() {
    for (let creditRowId of await this.dao.getOutstandingCreditRowIds()) {
      await this.db.withTransaction(async () => {
        await this.service.attemptInsertUserCreditForDepositFromTransaction(creditRowId)
      })
    }
  }


}
