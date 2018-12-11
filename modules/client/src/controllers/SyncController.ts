import { Connext, ConnextInternal } from '../Connext'
import Logger from '../lib/Logger'
import { BasePoller } from '../lib/poller/BasePoller'
import { SyncResult } from '../types'
import { ConnextStore } from '../state/store'
import getAddress from '../lib/getAddress'
import getTxCount from '../lib/getTxCount'
import {getLastThreadId} from '../lib/getLastThreadId'
import {syncEnqueueItems} from '../lib/syncEnqueueItems'
import {getSem} from '../lib/getSem'
import { AbstractController } from './AbstractController'

const TWO_SECONDS = 2 * 1000
const SYNC_ERROR = 'Unable to sync with hub'

export default class SyncController extends AbstractController {
  static POLLER_INTERVAL_LENGTH = TWO_SECONDS

  private poller: BasePoller

  constructor (name: string, connext: ConnextInternal) {
    super(name, connext)
    this.poller = new BasePoller(this.logger)
  }

  async start() {
    await this.poller.start(
      this.sync,
      SyncController.POLLER_INTERVAL_LENGTH
    )
  }

  async stop() {
    this.poller.stop()
  }

  public sync = async (): Promise<void> => {
    const sem = getSem(this.store)
    if (!sem.available(1)) {
      return
    }
    const result = await this.doSync()
    syncEnqueueItems(this.store, result)
  }

  private doSync = async (): Promise<SyncResult[]> => {
    try {
      return this.legacyConnext.sync(
        getTxCount(this.store) + 1,
        getLastThreadId(this.store),
        getAddress(this.store)
      )
    } catch (e) {
      console.error(SYNC_ERROR, {e})
      this.logToApi('sync', {e, message: SYNC_ERROR})
      throw e
    }
  }
}
