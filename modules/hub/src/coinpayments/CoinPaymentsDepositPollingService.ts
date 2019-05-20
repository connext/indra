import * as connext from 'connext'
import { DepositArgs } from 'connext/types'

import { CoinPaymentsDao } from './CoinPaymentsDao'
import { CoinPaymentsService } from './CoinPaymentsService'

import { default as Config } from '../Config'
import { default as DBEngine } from '../DBEngine'
import { default as log } from '../util/log'

const LOG = log('CoinPaymentsDepositPollingService')

export class CoinPaymentsDepositPollingService {
  private poller: connext.Poller

  constructor(
    private config: Config,
    private db: DBEngine,
    private service: CoinPaymentsService,
    private dao: CoinPaymentsDao,
  ) {
    this.poller = new connext.Poller({
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
