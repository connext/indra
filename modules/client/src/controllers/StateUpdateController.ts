import { ConnextState } from '../state/store'
import { ConnextStore } from '../state/store'
import { SyncResult, convertExchange, UpdateRequest, UnsignedChannelState } from '../types'
import { ChannelState, UpdateRequestTypes } from '../types'
import { AbstractController } from './AbstractController'
import * as actions from '../state/actions'
import { getChannel } from '../lib/getChannel'
import { Unsubscribe } from 'redux'
import { Action } from 'typescript-fsa/lib'
import { validateTimestamp } from '../lib/timestamp';
import { validateExchangeRate } from './ExchangeController';

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

    lastVal = val

    try {
      // If ``onChange`` raises an exception, set ``inCallback`` to false, but
      // don't try to retry. This means that we _could_ get into a weird state
      // (ie, if ``didChange = true`` and ``onChange(...)`` raises an
      // exception, then ``onChange(...)`` *should* be called, but also calling
      // it might raise another exception, so we don't).
      await onChange(val)
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
      state => state.runtime.syncResultsFromHub,
      items => this.syncOneItemFromStore(items[0]),
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

  private async syncOneItemFromStore(item: SyncResult) {
    if (!item)
      return
    await this.handleSyncItem(item)
    // NOTE: wallet doesnt like this, but this err
    // should be uncommented after moving client to npm repo
    // @ts-ignore 
    this.store.dispatch(actions.dequeueSyncResultsFromHub())
  }

  private async handleSyncItem(item: SyncResult) {
    this._queuedActions = []

    if (item.type === 'thread') {
      /*
      const update = actionItem.update
      const err = this.connext.validator.threadPayment(update.state)
      if (err) {
        console.error('Invalid thread signatures detected:', err, update)
        throw new Error('Invalid thread signatures: ' + err)
      }
      if (!actionItem.update.id)
        throw new Error('uh oh we should never have a thread update without an ID here')
      this.store.dispatch(actions.setLastThreadId(actionItem.update.id!))
      this.flushQueuedActions()
      continue
      */
      throw new Error('REB-36: enable threads!')
    }

    const update = item.update
    console.log(`Applying update from hub: ${update.reason} txCount=${update.txCount}:`, update)

    const prevState: ChannelState = getChannel(this.store)
    console.log('prevState:', prevState)
    if (update.txCount && update.txCount <= prevState.txCountGlobal) {
      console.warn(
        `StateUpdateController received update with old ` +
        `${update.txCount} < ${prevState.txCountGlobal}. Skipping.`
      )
      return
    }

    if (update.txCount && update.txCount != prevState.txCountGlobal + 1) {
      throw new Error(
        `Update txCount ${update.txCount} != ${prevState.txCountGlobal} + 1 ` +
        `(ie, the update is trying to be applied on top of a state that's ` +
        `later than our most recent state)`
      )
    }

    const nextState = await this.connext.validator.generateChannelStateFromRequest(prevState, update)

    // any sigs included on the updates should be valid
    this.assertValidSigs(update, nextState)

    // Note: it's important that the client doesn't do anything in response
    // to a double signed state, because it means a restored wallet can be
    // sync'd by sending it only the latest double-signed state. This isn't
    // necessarily a hard requirement - right now we're sending all states
    // on every sync - but it would be nice if we can make that guarantee.
    if (update.sigHub && update.sigUser) {
      this.store.dispatch(actions.setChannel({
        ...nextState,
        sigHub: update.sigHub,
        sigUser: update.sigUser,
      }))
      return
    }

    if (update.sigUser && !update.sigHub) {
      throw new Error('Update has user sig but not hub sig: ' + JSON.stringify(update))
    }

    const err = await (this.updateHandlers as any)[update.reason].call(this, prevState, update)
    if (err) {
      // TODO: return a state invalidation here (REB-9)
      console.error('State update validation failed' + err, update)
      throw new Error('State update validation failed' + err)
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
      reason: update.reason,
      args: update.args,
      state: signedState,
    })

    // when handling a deposit, the signed update will have both signatures
    // in that case, set the state
    if (signedState.sigHub && signedState.sigUser)
      this.store.dispatch(actions.setChannel(signedState))

    this.flushQueuedActions()
    await this.connext.awaitPersistentStateSaved()

    /*
    const hasActiveDeposit = this.store.getState().runtime.hasActiveDeposit
    const didReceiveConfirmPending = !!toSign.find(
      update => update.type === 'channel' && update.state.reason === 'ConfirmPending'
    )

    if (hasActiveDeposit && didReceiveConfirmPending) {
      this.store.dispatch(
        actions.setHasActiveDeposit(false)
      )
    }

    const hasActiveWithdrawal = this.store.getState().runtime.hasActiveWithdrawal
    if (hasActiveWithdrawal && didReceiveConfirmPending) {
      this.store.dispatch(actions.setHasActiveWithdrawal(false))
    }
    */
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
        await this.connext.depositController.sendUserAuthorizedDeposit(prev, update)
        return
      }

      throw new Error(
        `Recieved a ProposePendingDeposit from the hub that was not signed ` +
        `by the user (update: ${update})`
      )
    },

    // TODO: all of these (REB-6)
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
    'ConfirmPending': async (prev, update) => {

    },
    'OpenThread': async (prev, update) => {
      throw new Error('REB-36: enable threads!')
    },
    'CloseThread': async (prev, update) => {
      throw new Error('REB-36: enable threads!')
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
