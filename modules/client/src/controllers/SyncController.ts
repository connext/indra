import { UpdateRequest } from '../types'
import { ChannelStateUpdate, SyncResult } from '../types'
import { Poller } from '../lib/poller/Poller'
import { ConnextInternal } from '../Connext'
import { SyncControllerState } from '../state/store'
import getTxCount from '../lib/getTxCount'
import { getLastThreadId } from '../lib/getLastThreadId'
import { AbstractController } from './AbstractController'
import * as actions from '../state/actions'

const TWO_SECONDS = 2 * 1000

function channelUpdateToUpdateRequest(up: ChannelStateUpdate): UpdateRequest {
  return {
    reason: up.reason,
    args: up.args,
    txCount: up.state.txCountGlobal,
    sigHub: up.state.sigHub,
    sigUser: up.state.sigUser,
  }
}

export function mergeSyncResults(xs: SyncResult[], ys: SyncResult[]): SyncResult[] {
  const sorted = [ ...xs, ...ys ]
  sorted.sort((a, b) => {
    // When threads are enabled, we'll need to make sure they are being
    // sorted correctly with respect to channel updates. See comments in
    // the hub's algorithm which sorts sync results.
    if (a.type == 'thread' || b.type == 'thread')
      throw new Error('TODO: REB-36 (enable threads)')

    return a.update.txCount - b.update.txCount
  })

  // Dedupe updates by iterating over the sorted updates and ignoring any
  // duplicate txCounts (after copying over any signatures which exist on one
  // but no the other, if applicable; see comments below).
  const deduped = sorted.slice(0, 1)
  for (let next of sorted.slice(1)) {
    const cur = deduped[deduped.length - 1]

    if (next.type == 'thread' || cur.type == 'thread')
      throw new Error('TODO: REB-36 (enable threads)')

    if (next.update.txCount < cur.update.txCount) {
      throw new Error(
        `next update txCount should never be < cur: ` +
        `${JSON.stringify(next.update)} >= ${JSON.stringify(cur.update)}`
      )
    }

    if (next.update.txCount > cur.update.txCount) {
      deduped.push(next)
      continue
    }

    // The current and next updates both have the same txCount. Double check
    // that they both match (they *should* always match, because if they
    // don't it means that the hub has sent us two different updates with the
    // same txCount, and that is Very Bad. But better safe than sorry.)
    const nextSigs = next.update
    const curSigs = cur.update
    const nextAndCurMatch = (
      next.update.reason == cur.update.reason &&
      ((nextSigs.sigHub && curSigs.sigHub) ? nextSigs.sigHub == curSigs.sigHub : true) &&
      ((nextSigs.sigUser && curSigs.sigUser) ? nextSigs.sigUser == curSigs.sigUser : true)
    )
    if (!nextAndCurMatch) {
      throw new Error(
        `Got two updates from the hub with the same txCount but different ` +
        `reasons or signatures: ${JSON.stringify(next.update)} != ${JSON.stringify(cur.update)}`
      )
    }

    // Then copy over any signatures from the 'next' update to the 'cur'
    // update, then otherwise ignore it (ie, because it's a duplicate of the
    // current).
    if (nextSigs.sigHub)
      cur.update.sigHub = nextSigs.sigHub
    if (nextSigs.sigUser)
      cur.update.sigUser = nextSigs.sigUser
  }

  return deduped
}

export default class SyncController extends AbstractController {
  static POLLER_INTERVAL_LENGTH = TWO_SECONDS

  private poller: Poller

  constructor(name: string, connext: ConnextInternal) {
    super(name, connext)
    this.poller = new Poller(this.logger)
  }

  async start() {
    await this.poller.start(
      this.sync.bind(this),
      SyncController.POLLER_INTERVAL_LENGTH
    )
  }

  async stop() {
    this.poller.stop()
  }

  async sync() {
    try {
      const hubUpdates = await this.hub.sync(
        getTxCount(this.store) + 1,
        getLastThreadId(this.store),
      )
      this.enqueueSyncResultsFromHub(hubUpdates)
    } catch (e) {
      console.error('Sync error:', e)
      this.logToApi('sync', { message: '' + e })
      throw e
    }
  }

  protected getSyncState(): SyncControllerState {
    return this.store.getState().persistent.syncControllerState
  }

  public async sendUpdateToHub(update: ChannelStateUpdate) {
    const state = this.getSyncState()
    this.store.dispatch(actions.setSyncControllerState({
      ...state,
      updatesToSync: [
        ...state.updatesToSync,
        channelUpdateToUpdateRequest(update),
      ],
    }))
    this.flushPendingUpdatesToHub()
  }

  /**
   * Sends all pending updates (that is, those which have been put onto the
   * store, but not yet sync'd) to the hub.
   */
  private async flushPendingUpdatesToHub() {
    const state = this.getSyncState()
    console.log(`Sending updates to hub: ${state.updatesToSync.map(u => u && u.reason)}`)
    const hubUpdates = await this.hub.updateHub(
      state.updatesToSync,
      getLastThreadId(this.store),
    )

    const newState = this.getSyncState()
    this.store.dispatch(actions.setSyncControllerState({
      ...newState,
      updatesToSync: state.updatesToSync.slice(state.updatesToSync.length),
    }))
    this.enqueueSyncResultsFromHub(hubUpdates)
  }

  /**
   * Enqueues updates from the hub, to be handled by `StateUpdateController`.
   */
  public enqueueSyncResultsFromHub(updates: SyncResult[]) {
    if (updates.length === undefined)
      debugger;

    if (updates.length == 0)
      return

    const oldSyncResults = this.getState().runtime.syncResultsFromHub
    const merged = mergeSyncResults(oldSyncResults, updates)
    console.info(`updates: ${updates.length}; old len: ${oldSyncResults.length}; merged: ${merged.length}`)
    this.store.dispatch(actions.setSortedSyncResultsFromHub(merged))
  }
}
