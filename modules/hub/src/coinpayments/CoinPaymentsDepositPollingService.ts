import { Poller, types } from '../Connext'
import { CoinPaymentsService } from './CoinPaymentsService'
import { default as log } from '../util/log'
import { CoinPaymentsDao } from './CoinPaymentsDao'
import { default as DBEngine } from '../DBEngine'
import { default as Config } from '../Config'

type DepositArgs = types.DepositArgs
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
