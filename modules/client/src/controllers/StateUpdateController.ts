import { Unsubscribe } from 'redux'
import { Action } from 'typescript-fsa/lib'
import { AbstractController } from './AbstractController'
import { validateExchangeRate } from './ExchangeController';
import { validateTimestamp } from '../lib/timestamp';
import { assertUnreachable } from '../lib/utils'
import * as actions from '../state/actions'
import { ConnextState, ConnextStore } from '../state/store'
import {
  ChannelState,
  convertChannelState,
  convertExchange,
  SyncResult,
  UnsignedChannelState,
  UpdateRequest,
  UpdateRequestTypes,
  ThreadState,
} from '../types'
import { Utils } from '../Utils';

type StateUpdateHandlers = {
  [Type in keyof UpdateRequestTypes]: (
    this: StateUpdateController,
    prev: ChannelState,
    update: UpdateRequestTypes[Type],
  ) => Promise<string | null | void>
}

/**
 * Watch a value on the store, calling `onChange` callback each time it
 * changes.
 *
 * If the value changes while `onChange` is running, it will be called again
 * after it completes.
 */
export async function watchStore<T>(
  store: ConnextStore,
  getter: (s: ConnextState) => T,
  onChange: (v: T) => Promise<void>,
) {
  let inCallback = false
  let didChange = false
  let lastVal = {}

  async function onStoreChange() {
    const val = getter(store.getState())
    if (val === lastVal)
      return

    if (inCallback) {
      didChange = true
      return
    }
    inCallback = true

    const prevVal = lastVal
    lastVal = val

    try {
      // If ``onChange`` raises an exception, set ``inCallback`` to false, but
      // don't try to retry. This means that we _could_ get into a weird state
      // (ie, if ``didChange = true`` and ``onChange(...)`` raises an
      // exception, then ``onChange(...)`` *should* be called, but also calling
      // it might raise another exception, so we don't).
      await onChange(val)
    } catch (e) {

      // Some naieve but hopefully useful retry logic. If the onChange callback
      // throws an exception *and* the current item doesn't change for
      // 30 seconds, hope that it's a temporary failure and try again. This
      // should be safe because the callback should be idempotent, and we're
      // checking that it isn't already running before we call it.
      setTimeout(() => {
        console.warn(
          'Exception was previously raised by watchStore callback ' +
          'and no progress has been made in the last 30 seconds. ' +
          'Trying again...'
        )
        if (lastVal === val && !inCallback) {
          lastVal = {}
          onStoreChange()
        }
      }, 1000 * 30)

      throw e
    } finally {
      inCallback = false
    }

    if (didChange) {
      didChange = false
      await onStoreChange()
    }
  }

  await onStoreChange()
  return store.subscribe(onStoreChange)
}

export default class StateUpdateController extends AbstractController {
  private unsubscribe: Unsubscribe | null = null

  async start() {
    this.unsubscribe = await watchStore(
      this.store,
      state => {
        // channel in dispute status, prevent further updates
        // TODO: thoroughly handle client response
        const status = state.runtime.channelStatus
        if (status === "CS_CHANNEL_DISPUTE") {
          console.warn(`Not processing updates, channel is not open. Status: ${status}`)
          return null
        } else if (status === "CS_THREAD_DISPUTE") {
          console.warn(`Not processing updates, channel is not open. Status: ${status}`)
          return null
        }
        // channel is open
        const item = state.runtime.syncResultsFromHub[0]

        // No sync results from hub; nothing to do
        if (!item)
          return null

        // Wait until we've flushed all the updates to the hub before
        // processing the next item.
        const { updatesToSync } = state.persistent.syncControllerState
        if (updatesToSync.length > 0)
          return null

        // Otherwise, call `syncOneItemFromStore` on the item.
        return item
      },
      item => this.syncOneItemFromStore(item),
    )
  }

  async stop() {
    if (this.unsubscribe)
      this.unsubscribe()
  }

  private _queuedActions: null | Action<any>[] = null

  /**
   * Used by state update handlers to queue an action to be run after
   * `handleStateUpdates` has completed successfully.
   */
  private queueAction(action: Action<any>) {
    if (!this._queuedActions)
      throw new Error('Can only queue an action while `handleStateUpdates` is running!')
    this._queuedActions.push(action)
  }

  private flushQueuedActions() {
    if (!this._queuedActions)
      throw new Error('Can only flush queue while `handleStateUpdates` is running!')
    for (const action of this._queuedActions)
      this.store.dispatch(action)
    this._queuedActions = null
  }

  private async syncOneItemFromStore(item: SyncResult | null) {
    if (!item)
      return

    await this.handleSyncItem(item)
    this.store.dispatch(actions.dequeueSyncResultsFromHub(item))
  }

  public async handleSyncItem(item: SyncResult) {
    this._queuedActions = []

    if (item.type === 'thread') { // handle thread updates
      if (item.update.state.txCount == 0) {
        console.log(`Received opening thread state, should be handled in OpenThread channel update. State: ${JSON.stringify(this.getState(), null, 2)}`)
        return
      }

      if (!item.update.id) {
        throw new Error(`Uh oh! Thread update should definitely have the id at this point! Sync item: ${JSON.stringify(item)}`)
      }

      const persistent = this.getState().persistent

      // do nothing if update is below latest in store
      if (item.update.id <= persistent.lastThreadUpdateId) {
        // TODO: handle case where thread update is one
        // we need to close as a receiver
        console.warn(`Received old thread update, doing nothing.`)
        return
      }

      console.log(`Received a thread payment from the hub. Sync item: ${JSON.stringify(item)}`)
      // since threads are single-payment constructs, received thread
      // payments here should suggest that the thread is ready to be
      // closed if user == recipient
      
      // should update the active threads item in the store
      // with the thread at the new state.
      const newThreadState = item.update.state
      this.connext.validator.assertThreadSigner(newThreadState)

      // TODO: should we validate anything about the transition
      // or assume the validators have validated the update
      // as it was created?

      // should update the store with the new active thread state
      const prevThreadState = persistent.activeThreads.filter(
        t => t.threadId == newThreadState.threadId && t.sender == newThreadState.sender && t.receiver == newThreadState.receiver
      )

      if (prevThreadState.length != 1) {
        throw new Error(`Error finding previous thread state corresponding to given new thread state. New state: ${JSON.stringify(newThreadState)}. ${prevThreadState.length == 0 ? 'No thread found.' : `Multiple threads found ${JSON.stringify(prevThreadState)}`}`)
      }

      const newActiveThreads = persistent.activeThreads.filter(
        t => t.threadId != newThreadState.threadId && t.sender != newThreadState.sender && t.receiver != newThreadState.receiver
      ).concat([newThreadState])

      // update the latest id
      this.store.dispatch(actions.setLastThreadUpdateId(Number(item.update.id)))
      // update active threads state
      this.store.dispatch(actions.setActiveThreads(newActiveThreads))

      await this.connext.awaitPersistentStateSaved()
      
      // close the thread if the user is the receiver
      const channel = persistent.channel
      if (channel.user == newThreadState.receiver) {
        console.log('Closing thread after payment receipt.')
        await this.connext.threadsController.closeThread({
          sender: newThreadState.sender,
          receiver: newThreadState.receiver,
          threadId: newThreadState.threadId,
        })

        this.flushQueuedActions()
        await this.connext.awaitPersistentStateSaved()
      }
      return
    }

    let update = item.update
    console.log(`Applying update from hub: ${update.reason} txCount=${update.txCount}:`, update)

    const connextState = this.getState()
    const prevState: ChannelState = connextState.persistent.channel
    const latestValidState: ChannelState = connextState.persistent.latestValidState

    console.log('prevState:', prevState)

    if (update.txCount && update.txCount <= prevState.txCountGlobal) {
      console.warn(
        `StateUpdateController received update with old ` +
        `${update.txCount} < ${prevState.txCountGlobal}. Skipping.`
      )
      return
    }

    if (update.reason != 'Invalidation' && update.txCount && update.txCount != prevState.txCountGlobal + 1) {
      throw new Error(
        `Update txCount ${update.txCount} != ${prevState.txCountGlobal} + 1 ` +
        `(ie, the update is trying to be applied on top of a state that's ` +
        `later than our most recent state)`
      )
    }

    if (update.reason === 'EmptyChannel') {
      console.log('Channel has exited dispute phase, re-enabling client')
      this.store.dispatch(actions.setChannelStatus("CS_OPEN"))
    }

    // TODO: Write this for nukeThreads

    // add initial thread states from our store if the update
    // type includes threads
    if (update.reason.includes('Thread')) {
      update.initialThreadStates = connextState.persistent.activeInitialThreadStates
    }

    const nextState = await this.connext.validator.generateChannelStateFromRequest(
      update.reason === 'Invalidation' ? latestValidState : prevState,
      update
    )

    // any sigs included on the updates should be valid
    this.assertValidSigs(update, nextState)

    // Note: it's important that the client doesn't do anything in response
    // to a double signed state, because it means a restored wallet can be
    // sync'd by sending it only the latest double-signed state. This isn't
    // necessarily a hard requirement - right now we're sending all states
    // on every sync - but it would be nice if we can make that guarantee.
    if (update.sigHub && update.sigUser) {
      this.store.dispatch(actions.setChannelAndUpdate({
        update: update,
        state: {
          ...nextState,
          sigHub: update.sigHub,
          sigUser: update.sigUser,
        },
      }))

      // additionally, the client should update the thread properties
      // within the store if a double signed thread-channel (openThread, 
      // closeThread) update is returned by the hub
      if (update.reason.includes("Thread")) {
        const args = update.args as ThreadState
        // unconditionally update thread history whether it is open or close
        // thread.
        let wasDuplicate = false
        const threadHistory = connextState.persistent.threadHistory.map(t => {
          if (t.receiver == args.receiver && t.sender == args.sender) {
            // update the threadId in history with the one in args
            wasDuplicate = true
            return { ...t, threadId: args.threadId }
          } else {
            // otherwise, return the thread history item
            return t
          }
        })
        // if this is new sender/receiver combo, push the thread history item
        if (!wasDuplicate) {
          threadHistory.push({ 
            threadId: args.threadId,
            sender: args.sender,
            receiver: args.receiver,
          })
        }

        // update active initial states depending if open or close
        const prevActiveInitialThreads = connextState.persistent.activeInitialThreadStates
        const prevActiveThreads = connextState.persistent.activeThreads

        const activeInitialThreadStates = update.reason == "OpenThread" 
          ? prevActiveInitialThreads.concat(args)
          : prevActiveInitialThreads.filter(t => t.sender != args.sender && t.receiver != args.receiver && t.threadId != args.threadId)

        const activeThreads = update.reason == "OpenThread"
          ? prevActiveThreads.concat([args])
          : prevActiveThreads.filter(t => t.sender != args.sender && t.receiver != args.receiver && t.threadId != args.threadId)

        this.store.dispatch(actions.setThreadHistory(threadHistory))
        this.store.dispatch(actions.setActiveInitialThreadStates(activeInitialThreadStates))
        this.store.dispatch(actions.setActiveThreads(activeThreads))
      }
      
      return
    }

    if (update.sigUser && !update.sigHub) {
      throw new Error('Update has user sig but not hub sig: ' + JSON.stringify(update))
    }

    // NOTE: the previous state passed into the update handlers is NOT
    // the previous passed into the validators to generate the 
    // `nextState`.
    const err = await (this.updateHandlers as any)[update.reason].call(this, prevState, update)
    if (err) {
      console.warn('Not countersigning state update: ' + err)
      return
    }

    const signedState: ChannelState = await this.connext.signChannelState(nextState)
    if (update.sigHub)
      signedState.sigHub = update.sigHub

    // For the moment, send the state to the hub and await receipt before
    // saving the state to our local store. We're doing this *for now* because
    // it dramatically simplifies the sync logic, but does rely on trusting the
    // hub: the hub could reject a payment (ex, denying the user access to
    // content they purchased), then later countersign and return the state
    // (effectively stealing their money). We've decided that this is an
    // acceptable risk *for now* because it will only apply to custodial
    // payments (ie, the hub can't block thread payments), and it will be fixed
    // in the future by storing the pending payment locally, and alerting the
    // user if the hub attempts to countersign and return it later.
    await this.connext.syncController.sendUpdateToHub({
      id: update.id,
      reason: update.reason,
      args: update.args,
      state: signedState,
    })

    this.flushQueuedActions()
    await this.connext.awaitPersistentStateSaved()

  }

  /**
   * Theses handlers will be called for updates being sent from the hub.
   *
   * They should perform any update-reason-specific validation (for example,
   * the `Payment` handler should allow any payment where the recipient is
   * 'user' (ie, if the hub is sending us money), but if the recipient is
   * the hub (ie, we're paying the hub), it should double check that the state
   * has already been signed (otherwise the hub could send us an unsigned
   * payment from user-> hub).
   */
  updateHandlers: StateUpdateHandlers = {
    'Payment': async (prev, update) => {
      // We will receive Payment updates from the hub when:
      // 1. The hub has countersigned a payment we've made (ex, `recipient ==
      //    'hub'` and we have already signed it)
      // 2. The hub is sending us a payment (ex, a custodial payment; in this
      //    case, `recipient == 'user'` and will only have a hub sig)
      // 3. We're doing a multi-device sync (but we won't get here, because the
      //    state will be fully signed)

      // Allow any payment being made to us (ie, where recipient == 'user'),
      // but double check that we've signed the update if the hub is the
      // recipient (ie, because it was a state we generated in BuyController)
      assertSigPresence(update, 'sigHub')

      if (update.args.recipient != 'user') {
        assertSigPresence(update, 'sigUser')
      }
    },

    'Exchange': async (prev, update) => {
      // We will receive Exchange updates from the hub only when:
      // 1. The hub is countersigning and returning an exchange we have sent
      //    from the `ExchangeController`
      // 2. The ExchangeController sends an unsigned update here
      if (!update.sigHub) {
        const ExchangeError = (msg: string) => {
          return new Error(`${msg} (args: ${JSON.stringify(convertExchange("str", update.args))}; prev: ${JSON.stringify(prev)})`)
        }

        // validate the exchange rate against store
        const err = validateExchangeRate(this.store, update.args.exchangeRate)
        if (err)
          throw ExchangeError(err)
        return
      }
      assertSigPresence(update)
    },

    'ProposePendingDeposit': async (prev, update) => {
      // We will recieve ProposePendingDeposit updates from the hub when:
      // 1. The hub wants to collatoralize
      // 2. We have proposed a deposit (see DepositController)

      // 1: The hub is requesting a deposit, ex: it wants to collateralize
      if (!update.sigHub) {
        // This is a hub authorized deposit (ex, because the hub wants to
        // recollatoralize). We don't need to check or do anything other than
        // countersign and return to the hub.
        console.log('Received a hub authorized deposit; countersigning and returning.')
        const CollateralError = (msg: string) => {
          return new Error(`${msg} (args: ${JSON.stringify(update.args)}; prev: ${JSON.stringify(prev)})`)
        }

        // verification of args
        const tsErr = validateTimestamp(this.store, update.args.timeout)
        if (tsErr)
          throw CollateralError(tsErr)
        return
      }

      // 2: We have requested a deposit
      if (update.sigHub && !update.sigUser) {
        // Because we will only save the signed update once it has been sent to
        // chain, we can safely assume that the deposit is on chain
        // if-and-only-if we have signed it.
        // Note that the `sendDepositToChain` method will validate that the
        // deposit amount is the amount we expect.
        return await this.connext.depositController.sendUserAuthorizedDeposit(prev, update)
      }

      throw new Error(
        `Recieved a ProposePendingDeposit from the hub that was not signed ` +
        `by the user (update: ${update})`
      )
    },

    'ProposePendingWithdrawal': async (prev, update) => {
      if (!update.sigHub) {
        const WithdrawalError = (msg: string) => {
          return new Error(`${msg} (args: ${JSON.stringify(update.args)}; prev: ${JSON.stringify(prev)})`)
        }

        const tsErr = validateTimestamp(this.store, update.args.timeout)
        if (tsErr)
          throw WithdrawalError(tsErr)

        const exchangeErr = validateExchangeRate(this.store, update.args.exchangeRate)
        if (exchangeErr)
          throw WithdrawalError(exchangeErr)

        return
      }
    },

    'Invalidation': async (prev, update) => {
      // NOTE (BSU-72): this will break in two ways if the hub tries to
      // invalidate a state without a timeout:
      // 1. The txCountGlobal will not necessarily be the most recent (ex,
      //    because there may have been tips on top of the pending state)
      // 2. The `didContractEmitUpdateEvent` will throw an error because it
      //    has not been tested with `timeout = 0` states.

      if (update.args.lastInvalidTxCount !== prev.txCountGlobal) {
        throw new Error(
          `Hub proposed invalidation for a state which isn't our latest. ` +
          `Invalidation: ${JSON.stringify(update)} ` +
          `Latest state: ${JSON.stringify(prev)}`
        )
      }

      if (!this.connext.utils.hasPendingOps(prev)) {
        throw new Error(
          `Hub proposed invalidation for a double signed state with no ` +
          `pending fields. Invalidation: ${JSON.stringify(update)} ` +
          `state: ${JSON.stringify(prev)}`
        )
      }

      const { syncController } = this.connext
      const { didEmit, latestBlock, event } = await syncController.didContractEmitUpdateEvent(prev, update.createdOn)

      switch (didEmit) {
        case 'unknown':
          throw new Error(
            `Hub proposed an invalidation for an update that has not yet ` +
            `timed out. Update timeout: ${prev.timeout}; latest block: ` +
            `timestamp: ${latestBlock.timestamp} (hash: ${latestBlock.hash})`
          )

        case 'yes':
          throw new Error(
            `Hub proposed invalidation for a state that has made it to chain. ` +
            `State txCount: ${prev.txCountGlobal}, event: ${JSON.stringify(event)}`
          )

        case 'no':
          // No event was emitted, the state has timed out; countersign and
          // return the invalidation
          return

        default:
          assertUnreachable(didEmit)
      }

    },

    'ConfirmPending': async (prev, update) => {

    },

    'OpenThread': async (prev, update) => {
      // Clients could be receiving open thread updates when:
      // 1. The hub has countersigned the channel update with the 
      //    client user as the thread sender (client initiated thread 
      //    opening)
      //      - update should have both user and hub sig
      //        and should not make it to this point in the code
      // 2. The client is the receiver, and the hub is letting the client 
      //    know that it has bonded in the channel. In this case:
      //      - client should verify it is the receiver and cosign
      //        and validate the thread update (store is updated  on
      //        second round of syncing when both sigs present)
      assertSigPresence(update, 'sigHub')
      if (update.args.receiver != prev.user) {
        throw new Error(`Something funny is going on. Client has received an open thread update from the hub, where the client is the sender. Somehow, this was missing a user sig. See comments in source. Update: ${JSON.stringify(update)}, previous: ${JSON.stringify(prev)}`)
      }
      // someone is opening a thread with us!
    },
    'CloseThread': async (prev, update) => {
      // Close thread updates can be received in the following
      // conditions:
      //  1. Sender is receiving a close thread notification from the hub
      //     indicating that the receiver has gotten the payment
      //        - sender should validate + countersign the update
      //  2. Receiver is getting acknowledgment from the hub that the
      //     thread has been removed from their channel state
      //        - the update should have both sigs, and should not
      //          make it to this point in the code
      assertSigPresence(update, 'sigHub')
      if (update.args.sender != prev.user) {
        throw new Error(`Something funny is going on. Client has received a close thread update from the hub, where the client is the receiver. Somehow, this was missing a user sig. See comments in source. Update: ${JSON.stringify(update)}, previous: ${JSON.stringify(prev)}`)
      }
      // make sure that the thread being closed exists in our local 
      // storage under activeThreads and activeInitialStates
      // will be removed when hub gets signed channel state (see comment  
      // line 296)
      const persistent = this.store.getState().persistent
      const args = update.args as ThreadState
      const initialState = persistent.activeInitialThreadStates.filter(t => t.sender == args.sender && t.receiver == args.receiver && t.threadId == args.threadId)[0]
      const activeThread = persistent.activeThreads.filter(t => t.sender == args.sender && t.receiver == args.receiver && t.threadId == args.threadId)[0]
      if (!activeThread || !initialState) {
        throw new Error(`Hub is trying to close thread we have no local record of. Update: ${JSON.stringify(update)}`)
      }
    },
    'EmptyChannel': async (prev, update) => {
      
    },
  }

  private assertValidSigs(update: UpdateRequest, proposed: UnsignedChannelState) {
    // if sig is on the update, it recovers it
    // if the sig is not on the update, it does nothing
    if (update.sigHub) {
      this.validator.assertChannelSigner({ sigHub: update.sigHub, ...proposed }, "hub")
    }

    if (update.sigUser) {
      this.validator.assertChannelSigner({ sigUser: update.sigUser, ...proposed }, "user")
    }
  }

}


/**
 * This function takes sigs and asserts that they exist and that they are
 * signed by the correct person.
 * @param x: string of sigs to assert 
 */
function assertSigPresence(update: UpdateRequest, x?: "sigHub" | "sigUser") {
  if (x && !update[x])
    throw new Error(`${x} not detected in update: ${JSON.stringify(update)}`)
  if (!x && !update["sigHub"] && !update["sigUser"]) {
    throw new Error(`Update does not have both signatures ${JSON.stringify(update)}`)
  }
}
