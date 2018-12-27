import { UpdateRequest } from '../types'
import { ChannelStateUpdate, SyncResult } from '../types'
import { Poller } from '../lib/poller/Poller'
import { ConnextInternal } from '../Connext'
import { SyncControllerState } from '../state/store'
import getTxCount from '../lib/getTxCount'
import { getLastThreadId } from '../lib/getLastThreadId'
import { AbstractController } from './AbstractController'
import * as actions from '../state/actions'
import { maybe, Lock } from '../lib/utils'
import Semaphore = require('semaphore')

const TWO_SECONDS = 2 * 1000
const TEN_SECONDS = 10 * 1000

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
  let sorted = [...xs, ...ys]
  sorted.sort((a, b) => {
    // When threads are enabled, we'll need to make sure they are being
    // sorted correctly with respect to channel updates. See comments in
    // the hub's algorithm which sorts sync results.
    if (a.type == 'thread' || b.type == 'thread')
      throw new Error('TODO: REB-36 (enable threads)')

    // Always sort the current single unsigned state from the hub last
    if (!a.update.txCount)
      return 1

    if (!b.update.txCount)
      return -1

    return a.update.txCount - b.update.txCount
  })

  // Filter sorted to ensure there is just one update with a null txCount
  let hasNull = false
  sorted = sorted.filter(s => {
    if (s.type == 'thread')
      throw new Error('TODO: REB-36 (enable threads)')

    if (!s.update.txCount) {
      if (hasNull)
        return false
      hasNull = true
      return true
    }

    return true
  })

  // Dedupe updates by iterating over the sorted updates and ignoring any
  // duplicate txCounts (after copying over any signatures which exist on one
  // but no the other, if applicable; see comments below).
  const deduped = sorted.slice(0, 1)
  for (let next of sorted.slice(1)) {
    const cur = deduped[deduped.length - 1]

    if (next.type == 'thread' || cur.type == 'thread')
      throw new Error('TODO: REB-36 (enable threads)')

    if (next.update.txCount && next.update.txCount < cur.update.txCount!) {
      throw new Error(
        `next update txCount should never be < cur: ` +
        `${JSON.stringify(next.update)} >= ${JSON.stringify(cur.update)}`
      )
    }

    if (!next.update.txCount || next.update.txCount > cur.update.txCount!) {
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
  static POLLER_INTERVAL_LENGTH = TEN_SECONDS

  private poller: Poller

  private flushErrorCount = 0

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
        getTxCount(this.store),
        getLastThreadId(this.store),
      )
      this.enqueueSyncResultsFromHub(hubUpdates)
    } catch (e) {
      console.error('Sync error:', e)
      this.logToApi('sync', { message: '' + e })
    }

    try {
      await this.flushPendingUpdatesToHub()
    } catch (e) {
      console.error('Flush error:', e)
      this.logToApi('flush', { message: '' + e })
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
  private flushLock = Semaphore(1)
  private async flushPendingUpdatesToHub() {
    // Lock around `flushPendingUpdatesToHub` to make sure it doesn't get
    // called by both the poller something else at the same time.
    return new Promise(res => {
      this.flushLock.take(async () => {
        try {
          await this._flushPendingUpdatesToHub()
        } catch (e) {
          console.error('Error flushing updates:', e)
        } finally {
          this.flushLock.leave()
          res()
        }
      })
    })
  }

  private async _flushPendingUpdatesToHub() {
    const state = this.getSyncState()
    if (!state.updatesToSync.length)
      return

    console.log(`Sending updates to hub: ${state.updatesToSync.map(u => u && u.reason)}`, state.updatesToSync)
    const [res, err] = await maybe(this.hub.updateHub(
      state.updatesToSync,
      getLastThreadId(this.store),
    ))

    let shouldRemoveUpdates = true

    if (err || res.error) {
      const error = err || res.error
      this.flushErrorCount += 1
      const triesRemaining = Math.max(0, 4 - this.flushErrorCount)
      console.error(
        `Error sending updates to hub (will flush and reset ` +
        `${triesRemaining ? `after ${triesRemaining} attempts` : `now`}): ` +
        `${error}`
      )

      if (triesRemaining <= 0) {
        console.error(
          'Too many failed attempts to send updates to hub; flushing all of ' +
          'our updates. Updates being flushed:',
          state.updatesToSync,
        )
      } else {
        shouldRemoveUpdates = false
      }

      // If there's a bug somewhere, it can cause a loop here where the hub
      // sends something bad, wallet does something bad, then immidately sends
      // back to the hub... so sleep a bit to make sure we don't clobber the
      // poor hub.
      console.log('Sleeping for a bit before trying again...')
      await new Promise(res => setTimeout(res, 6.9 * 1000))
    } else {
      this.flushErrorCount = 0
    }

    if (shouldRemoveUpdates) {
      const newState = this.getSyncState()
      this.store.dispatch(actions.setSyncControllerState({
        ...newState,
        updatesToSync: newState.updatesToSync.slice(state.updatesToSync.length),
      }))
    }

    this.enqueueSyncResultsFromHub(res.updates)
  }

  /**
   * Enqueues updates from the hub, to be handled by `StateUpdateController`.
   */
  public enqueueSyncResultsFromHub(updates: SyncResult[]) {
    if (updates.length === undefined)
      throw new Error(`This should never happen, this was called incorrectly. An array of SyncResults should always have a defined length.`)

    if (updates.length == 0)
      return

    const oldSyncResults = this.getState().runtime.syncResultsFromHub
    const merged = mergeSyncResults(oldSyncResults, updates)
    console.info(`updates: ${updates.length}; old len: ${oldSyncResults.length}; merged: ${merged.length}`)

    // De-dupe incoming updates and remove any that are already in queue to be
    // sent to the hub. Note that this still isn't _perfect_; there is a race
    // condition where we could:
    // 1. Start a sync request
    // 2. Send our entire update queue to the hub
    // 3. Recieve a response to our sync request that contains updates that
    //    were sent in 2.
    // This isn't a huge issue because everything is idempotent, but it might
    // lead to some scarry looking errors.
    const updateKey = (u: UpdateRequest) => u.id && u.id < 0 ? `unsigned:${u.id}` : `tx:${u.txCount}`
    const existing = {} as any
    this.getSyncState().updatesToSync.forEach(u => {
      existing[updateKey(u)] = true
    })
    const filtered = merged.filter(u => {
      if (u.type != 'channel')
        throw new Error('TODO: REB-36 (enable threads)')
      return !existing[updateKey(u.update)]
    })

    console.info(`updates from hub: ${updates.length}; old len: ${oldSyncResults.length}; merged: ${filtered.length}:`, filtered)
    this.store.dispatch(actions.setSortedSyncResultsFromHub(merged))
  }
}
