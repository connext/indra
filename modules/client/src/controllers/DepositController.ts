import getTxCount from '../lib/getTxCount'
import { Payment, convertDeposit, convertChannelState, ChannelState, UpdateRequestTypes, SyncResult, UpdateRequest } from '../types'
import { getLastThreadId } from '../lib/getLastThreadId'
import { AbstractController } from "./AbstractController";
import { validateTimestamp } from "../lib/timestamp";
import * as actions from "../state/actions"

/*
 * Rule:
 * - Lock needs to be held any time we're requesting sync from the hub
 * - We can send updates to the hub any time we want (because the hub will
 *   reject them if they are out of sync)
 * - In the case of deposit, the `syncController` will expose a method
 *   called something like "tryEnqueueSyncResultsFromHub", which will add the
 *   sync results if the lock isn't held, but ignore them otherwise (ie,
 *   because they will be picked up on the next sync anyway), and this method
 *   will be used by the DepositController.
 */
export default class DepositController extends AbstractController {
  private requestedDeposit: Payment | null = null
  private resolvePendingDepositPromise: any = null

  public async requestUserDeposit(deposit: Payment) {
    // Note: this is also enforced by the state update validator (which
    // shouldn't allow an update while there there are still `pending` fields).
    // This check is mostly a sanity check.
    if (this.requestedDeposit) {
      throw new Error(
        `Cannot request a new deposit while one is still pending!\n` +
        `Request: ${JSON.stringify(deposit)}\nPending: ${JSON.stringify(this.requestedDeposit)}`
      )
    }

    this.requestedDeposit = deposit

    const sync = await this.hub.requestDeposit(
      deposit,
      getTxCount(this.store),
      getLastThreadId(this.store)
    )

    this.connext.syncController.enqueueSyncResultsFromHub(sync)

    // There can only be one pending deposit at a time, so it's safe to return
    // a promise that will resolve/reject when we eventually hear back from the
    // hub.
    return new Promise((res, rej) => {
      this.resolvePendingDepositPromise = { res, rej }
    })
  }

  /**
   * Given arguments for a user authorized deposit which we want to send
   * to chain, generate a state for that deposit, send that state to chain,
   * and return the state once it has been successfully added to the mempool.
   */
  public async sendUserAuthorizedDeposit(prev: ChannelState, update: UpdateRequestTypes['ProposePendingDeposit']) {
    try {
      await this._sendUserAuthorizedDeposit(prev, update)
      this.resolvePendingDepositPromise && this.resolvePendingDepositPromise.res()
    } catch (e) {
      this.resolvePendingDepositPromise && this.resolvePendingDepositPromise.rej(e)
      throw e
    } finally {
      this.resolvePendingDepositPromise = null
      this.requestedDeposit = null
    }
  }

  private async _sendUserAuthorizedDeposit(prev: ChannelState, update: UpdateRequestTypes['ProposePendingDeposit']) {
    function DepositError(msg: string) {
      return new Error(`${msg} (update: ${JSON.stringify(update)}; prev: ${JSON.stringify(prev)})`)
    }

    if (!update.sigHub) {
      throw DepositError(`A userAuthorizedUpdate must have a sigHub`)
    }

    if (update.sigUser) {
      // The `StateUpdateController` maintains the invariant that a
      // userAuthorizedUpdate will have a `sigUser` if-and-only-if it has been
      // sent to chain, so if the update being provided here has a user sig,
      // then either it has already been sent to chain, or there's a bug
      // somewhere.
      throw DepositError(
        `Cannot send a userAuthorizedUpdate which already has a sigUser ` +
        `(see comments in source)`
      )
    }

    const tsErr = validateTimestamp(this.store, update.args.timeout)
    if (tsErr)
      throw DepositError(tsErr)

    if (!this.requestedDeposit) {
      // Make the simplifying assumption that we will only respond to a deposit
      // if we have, in the same session, requested a deposit. It would be
      // possible to make this logic more complex, but it's reasonable to
      // assume that we'll only get a user deposit in response to
      // `requestUserDeposit`, and further that the same instance of the client
      // that requested the deposit will handle the deposit.
      // TODO: REB-12: this should return an Invalidation update
      throw DepositError(
        `Got deposit request without a corresponding request ` +
        `(see comments in source)`
      )
    }

    const { args } = update
    if (
      args.depositWeiUser != this.requestedDeposit.amountWei ||
      args.depositTokenUser != this.requestedDeposit.amountToken
    ) {
      throw DepositError(`Deposit request does not match requested deposit!`)
    }

    try {
      console.log('Sending user authorized deposit to chain.')
      const state = await this.connext.signChannelState(
        this.validator.generateProposePendingDeposit(
          prev,
          update.args,
        ),
      )
      state.sigHub = update.sigHub
      const tx = await this.connext.contract.userAuthorizedUpdate(state)
      await tx.awaitEnterMempool()
      // update the channel in the state
      // this.connext.syncController.enqueueSyncResultsFromHub([{ type: "channel", update }])
    } catch (e) {
      throw DepositError('' + e)
    }
  }
}
