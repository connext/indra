import { UpdateRequest, ChannelState, convertChannelState, InvalidationArgs, Sync } from '../types'
import { assertUnreachable } from '../lib/utils'
import { Block } from 'web3/eth/types'
import { ChannelStateUpdate, SyncResult, InvalidationReason } from '../types'
import { Poller } from '../lib/poller/Poller'
import { ConnextInternal } from '../Connext'
import { SyncControllerState, CHANNEL_ZERO_STATE } from '../state/store'
import getTxCount from '../lib/getTxCount'
import { getLastThreadUpdateId } from '../lib/getLastThreadUpdateId'
import { AbstractController } from './AbstractController'
import * as actions from '../state/actions'
import { maybe, Lock } from '../lib/utils'
import Semaphore = require('semaphore')
import { getChannel } from '../lib/getChannel';
import { EventLog } from 'web3/types'
import { hasPendingOps } from '../hasPendingOps'

function channelUpdateToUpdateRequest(up: ChannelStateUpdate): UpdateRequest {
  return {
    id: up.id,
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
  // duplicate txCounts with identical signatures.
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

    // If the two updates have different sigs (ex, the next update is the
    // countersigned version of the prev), then keep both
    if (nextSigs.sigHub != cur.update.sigHub || nextSigs.sigUser != cur.update.sigUser) {
      deduped.push(next)
      continue
    }

    // Otherwise the updates are identical; ignore the "next" update.
  }

  return deduped
}


export function filterPendingSyncResults(fromHub: SyncResult[], toHub: UpdateRequest[]) {
  // De-dupe incoming updates and remove any that are already in queue to be
  // sent to the hub. This is done by removing any incoming updates which
  // have a corresponding (by txCount, or id, in the case of unsigned
  // updates) update and fewer signatures than the update in queue to send to
  // the hub. Additionally, if there is an invalidation in the queue of updates
  // to be sent, the corresponding incoming update will be ignored.
  const updateKey = (u: UpdateRequest) => u.id && u.id < 0 ? `unsigned:${u.id}` : `tx:${u.txCount}`

  const existing: { [key: string]: { sigHub: boolean, sigUser: boolean } } = {}
  toHub.forEach(u => {
    existing[updateKey(u)] = {
      sigHub: !!u.sigHub,
      sigUser: !!u.sigUser,
    }

    if (u.reason == 'Invalidation') {
      const args: InvalidationArgs = u.args as InvalidationArgs
      for (let i = args.previousValidTxCount + 1; i <= args.lastInvalidTxCount; i += 1) {
        existing[`tx:${i}`] = {
          sigHub: true,
          sigUser: true,
        }
      }
    }
  })

  return fromHub.filter(u => {
    if (u.type != 'channel')
      throw new Error('TODO: REB-36 (enable threads)')

    const cur = existing[updateKey(u.update)]
    if (!cur)
      return true

    if (cur.sigHub && !u.update.sigHub)
      return false

    if (cur.sigUser && !u.update.sigUser)
      return false

    return true
  })
}


export default class SyncController extends AbstractController {
  static POLLER_INTERVAL_LENGTH = 2 * 1000

  private poller: Poller

  private flushErrorCount = 0

  constructor(name: string, connext: ConnextInternal) {
    super(name, connext)
    this.poller = new Poller({
      name: 'SyncController',
      interval: SyncController.POLLER_INTERVAL_LENGTH,
      callback: this.sync.bind(this),
      timeout: 5 * 60 * 1000,
    })

  }

  async start() {
    await this.poller.start()
  }

  async stop() {
    this.poller.stop()
  }

  async sync() {
    try {
      const state = this.store.getState()
      const hubSync = await this.hub.sync(
        state.persistent.channel.txCountGlobal,
        getLastThreadUpdateId(this.store),
      )
      if (!hubSync) {
        console.log('No updates found from the hub to sync')
        return
      }
      this.handleHubSync(hubSync)
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

    try {
      await this.checkCurrentStateTimeoutAndInvalidate()
    } catch (e) {
      this.logToApi('invalidation-check', { message: '' + e })
      console.error('Error checking whether current state should be invalidated:', e)
    }

  }

  public getSyncState(): SyncControllerState {
    return this.store.getState().persistent.syncControllerState
  }

  private async checkCurrentStateTimeoutAndInvalidate() {
    // If latest state has a timeout, check to see if event is mined
    const state = this.getState()

    const { channel, channelUpdate } = this.getState().persistent
    if (!channel.timeout)
      return

    // Wait until all the hub's sync results have been handled before checking
    // if we need to invalidate (the current state might be invalid, but the
    // pending updates from the hub might resolve that; ex, they might contain
    // an ConfirmPending).
    if (state.runtime.syncResultsFromHub.length > 0)
      return

    const { didEmit, latestBlock } = await this.didContractEmitUpdateEvent(channel)
    switch (didEmit) {
      case 'unknown':
        // The timeout hasn't expired yet; do nothing.
        return

      case 'yes':
        // For now, just sit tight and wait for Chainsaw to find the event. In
        // the future, the client could send a `ConfirmPending` here.
        return

      case 'no':
        const msg = (
          `State has timed out (timestamp: ${channel.timeout} < latest block ` +
          `${latestBlock.timestamp} (${latestBlock.number}/${latestBlock.hash}) and no ` +
          `DidUpdateChannel events have been seen since block ${latestBlock.number - 2000}`
        )
        await this.sendInvalidation(channelUpdate, 'CU_INVALID_TIMEOUT', msg)
        return

      default:
        assertUnreachable(didEmit)
    }
  }

  /**
   * Checks to see whether a `DidUpdateChannel` event with `txCountGlobal`
   * matching `channel.txCountGlobal` has been emitted.
   *
   * Returns 'yes' if it has, 'no' if it has not, and 'unknown' if the
   * channel's timeout has not yet expired.
   */
  public async didContractEmitUpdateEvent(channel: ChannelState): Promise<{
    didEmit: 'yes' | 'no' | 'unknown'
    latestBlock: Block
    event?: EventLog
  }> {
    if (!channel.timeout) {
      // Note: this isn't a hard or inherent limitation... but do it here for
      // now to make sure we don't accidentally do Bad Things for states
      // with pending operations where the timeout = 0.
      throw new Error(
        'Cannot check whether the contract has emitted an event ' +
        'for a state without a timeout. State: ' + JSON.stringify(channel)
      )
    }

    let block = await this.findBlockNearestTimeout(channel.timeout)
    if (block.timestamp < channel.timeout)
      return { didEmit: 'unknown', latestBlock: block }

    const evts = await this.connext.getContractEvents(
      'DidUpdateChannel',
      Math.max(block.number - 2000, 0), // 2000 blocks = ~8 hours
    )
    const event = evts.find(e => e.returnValues.txCount[0] == channel.txCountGlobal)
    if (event)
      return { didEmit: 'yes', latestBlock: block, event }

    return { didEmit: 'no', latestBlock: block }
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
   * If the current latest block has a `timestamp < timeout`, return the current
   * latest block. Otherwise find a block with a
   * `timestamp > timeout && timestamp < timeout + 60 minutes` (ie, a block
   * with a timestamp greater than the timeout, but no more than 60 minutes
   * greater).
   */
  async findBlockNearestTimeout(timeout: number, delta = 60 * 60): Promise<Block> {
    let block = await this.connext.opts.web3.eth.getBlock('latest')
    if (block.timestamp < timeout + delta)
      return block

    // Do a sort of binary search for a valid target block
    // Start with a step of 10k blocks (~2 days)
    // Precondition:
    //   block.timestamp >= timeout + delta
    // Invariants:
    //   1. block.number + step < latestBlock.number
    //   2. if step < 0: block.timestamp >= timeout + delta
    //   3. if step > 0: block.timestamp < timeout + delta
    let step = -1 * Math.min(block.number, 10000)
    while (true) {
      if (Math.abs(step) <= 2) {
        // This should never happen, and is a sign that we'll get into an
        // otherwise infinite loop. Indicative of a bug in the code.
        throw new Error(
          `Step too small trying to find block (this should never happen): ` +
          `target timeout: ${timeout}; block: ${JSON.stringify(block)}`
        )
      }

      block = await this.connext.opts.web3.eth.getBlock(block.number + step)
      if (block.timestamp > timeout && block.timestamp < timeout + delta) {
        break
      }

      if (block.timestamp < timeout) {
        // If the current block's timestamp is before the timeout, step
        // forward half a step.
        step = Math.ceil(Math.abs(step) / 2)
      } else {
        // If the current block's timestamp is after the timeout, step
        // backwards a full step. Note: we can't step backwards half a step
        // because we don't know how far back we're going to need to look,
        // so guarantee progress only in the "step forward" stage.
        step = Math.abs(step) * -1
      }

    }

    return block
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
      getLastThreadUpdateId(this.store),
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

    // First add any new items into the sync queue...
    this.enqueueSyncResultsFromHub(res.updates.updates)

    // ... then flush any pending items. This order is important to make sure
    // that the merge methods work correctly.
    if (shouldRemoveUpdates) {
      const newState = this.getSyncState()
      this.store.dispatch(actions.setSyncControllerState({
        ...newState,
        updatesToSync: newState.updatesToSync.slice(state.updatesToSync.length),
      }))
    }
  }

  /**
   * Responsible for handling sync responses from the hub, specifically
   * the channel status.
  */
  public handleHubSync(sync: Sync) {
    if (this.store.getState().runtime.channelStatus !== sync.status) {
      this.store.dispatch(actions.setChannelStatus(sync.status))
    }

    // signing disabled in state update controller based on channel sync status
    // unconditionally enqueue results
    this.enqueueSyncResultsFromHub(sync.updates)

    // descriptive status error handling
    switch (sync.status) {
      case "CS_OPEN":
        break
      case "CS_CHANNEL_DISPUTE":
        break
      case "CS_THREAD_DISPUTE":
        throw new Error('THIS IS BAD. Channel is set to thread dispute state, before threads are enabled. See See REB-36. Disabling client.')
      default:
        assertUnreachable(sync.status)
    }
  }

  /**
   * Enqueues updates from the hub, to be handled by `StateUpdateController`.
   */
  private enqueueSyncResultsFromHub(updates: SyncResult[]) {
    if (updates.length === undefined)
      throw new Error(`This should never happen, this was called incorrectly. An array of SyncResults should always have a defined length.`)

    if (updates.length == 0)
      return

    const oldSyncResults = this.getState().runtime.syncResultsFromHub
    const merged = mergeSyncResults(oldSyncResults, updates)
    const filtered = filterPendingSyncResults(merged, this.getSyncState().updatesToSync)

    console.info(`updates from hub: ${updates.length}; old len: ${oldSyncResults.length}; merged: ${filtered.length}:`, filtered)
    this.store.dispatch(actions.setSortedSyncResultsFromHub(filtered))
  }

  /**
   * Sends an invalidation to the hub.
   *
   * Note: this assumes that the caller has guaranteed that the state can
   * safely be invalidated. Currently this is true because `sendInvalidation`
   * is only called from one place - checkCurrentStateTimeoutAndInvalidate -
   * which performs the appropriate checks.
   *
   * If this gets called from other places, care will need to be taken to
   * ensure they have done the appropriate validation too.
   */
  private async sendInvalidation(
    updateToInvalidate: UpdateRequest,
    reason: InvalidationReason,
    message: string,
  ) {
    console.log(
      `Sending invalidation of txCount=${updateToInvalidate.txCount} ` +
      `because: ${reason} (${message})`
    )
    console.log(`Update being invalidated:`, updateToInvalidate)

    if (!updateToInvalidate.txCount || !updateToInvalidate.sigHub) {
      console.error(
        `Oops, it doesn't make sense to invalidate an unsigned update, ` +
        `and requested invalidation is an unsigned update without a txCount/sigHub: `,
        updateToInvalidate,
      )
      return
    }

    // at the moment, you cannot invalidate states that have pending
    // operations and have been built on top of
    const channel = getChannel(this.store)
    if (
      // If the very first propose pending is invalidated, then the
      // channel.txCountGlobal will be 0
      !(channel.txCountGlobal == 0 && updateToInvalidate.txCount == 1) &&
      updateToInvalidate.txCount < channel.txCountGlobal &&
      updateToInvalidate.reason.startsWith("ProposePending")
    ) {
      throw new Error(
        `Cannot invalidate 'ProposePending*' type updates that have been built ` +
        `on (channel: ${JSON.stringify(channel)}; updateToInvalidate: ` +
        `${JSON.stringify(updateToInvalidate)})`
      )
    }

    // If we've already signed the update that's being invalidated, make sure
    // the corresponding state being invalidated (which is, for the moment,
    // always going to be our current state, as guaranteed by the check above)
    // has pending operations.
    if (updateToInvalidate.sigUser && !hasPendingOps(channel)) {
      throw new Error(
        `Refusing to invalidate an update with no pending operations we have already signed: ` +
        `${JSON.stringify(updateToInvalidate)}`
      )
    }

    const latestValidState = this.getState().persistent.latestValidState
    const args: InvalidationArgs = {
      previousValidTxCount: latestValidState.txCountGlobal,
      lastInvalidTxCount: updateToInvalidate.txCount,
      reason,
      message,
    }

    const invalidationState = await this.connext.signChannelState(
      this.validator.generateInvalidation(latestValidState, args)
    )

    await this.sendUpdateToHub({
      reason: 'Invalidation',
      state: invalidationState,
      args,
    })
  }
}
