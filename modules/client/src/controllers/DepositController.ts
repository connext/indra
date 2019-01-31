import getTxCount from '../lib/getTxCount'
import { Payment, convertDeposit, convertChannelState, ChannelState, UpdateRequestTypes, SyncResult, UpdateRequest, ChannelStateUpdate } from '../types'
import { getLastThreadId } from '../lib/getLastThreadId'
import { AbstractController } from "./AbstractController";
import { validateTimestamp } from "../lib/timestamp";
import * as actions from "../state/actions"
import { getChannel } from '../lib/getChannel'
import { PendingRequestedDeposit } from '../state/store'
const tokenAbi = require("human-standard-token-abi")

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
  private resolvePendingDepositPromise: any = null

  private async getRequestedDeposit() {
    const req = this.getState().persistent.requestedDeposit
    if (!req)
      return null

    const state = this.store.getState()
    const channel = state.persistent.channel

    // 1. If the saved request has a txCount but that txCount has been
    //    fully signed, then we can safely discard the pending request.
    if (req.txCount && channel.txCountGlobal >= req.txCount) {
      await this.saveRequestedDeposit(null)
      return null
    }

    // 2. Otherwise, if the saved request does have a txCount, it means we're
    //    waiting for it to go to chain, or waiting for the hub to confirm
    //    our countersig.
    if (req.txCount)
      return req

    // 3. If the request does not have a txCount and it's more than 5 minutes
    //    old, it's very likely (although we can't guarantee) that we'll never
    //    hear back from the hub, so discard the pending request
    const now = Date.now()
    if ((now - req.requestedOn) / 1000 > 60 * 5) {
      await this.saveRequestedDeposit(null)
      return null
    }

    return req
  }

  private async saveRequestedDeposit(req: PendingRequestedDeposit | null, ignoreErrors = false) {
    try {
      this.store.dispatch(actions.setRequestedDeposit(req))
      await this.connext.awaitPersistentStateSaved()
    } catch (e) {
      if (!ignoreErrors)
        throw e
      console.error('Error saving pending deposit state (which will be ignored):', e)
    }
  }

  public async requestUserDeposit(deposit: Payment) {
    // Note: this is also enforced by the state update validator (which
    // shouldn't allow an update while there there are still `pending` fields).
    // This check is mostly a sanity check.
    const requestedDeposit = await this.getRequestedDeposit()
    if (requestedDeposit) {
      throw new Error(
        `Cannot request a new deposit while one is still pending!\n` +
        `Request: ${JSON.stringify(deposit)}\nPending: ${JSON.stringify(requestedDeposit)}`
      )
    }

    await this.saveRequestedDeposit({
      amount: deposit,
      requestedOn: Date.now(),
      txCount: null,
    })

    try {
      const sync = await this.hub.requestDeposit(
        deposit,
        getTxCount(this.store),
        getLastThreadId(this.store)
      )

      this.connext.syncController.enqueueSyncResultsFromHub(sync)
    } catch (e) {
      await this.saveRequestedDeposit(null, true)
      throw e
    }

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
      console.warn(
        `Error handling userAuthorizedUpdate (this update will be ` +
        `countersigned and held until it expires - at which point it ` +
        `will be invalidated - or the hub sends us a subsequent ` +
        `ConfirmPending.`, e
      )
      this.resolvePendingDepositPromise && this.resolvePendingDepositPromise.rej(e)
    } finally {
      this.resolvePendingDepositPromise = null
      await this.saveRequestedDeposit(null, true)
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

    const state = await this.connext.signChannelState(
      this.validator.generateProposePendingDeposit(
        prev,
        update.args,
      ),
    )
    state.sigHub = update.sigHub

    const tsErr = validateTimestamp(this.store, update.args.timeout)
    if (tsErr) {
      throw DepositError(tsErr)
    }

    const requestedDeposit = await this.getRequestedDeposit()
    if (!requestedDeposit) {
      // Make the simplifying assumption that we will only respond to a deposit
      // if we have requested a deposit. It would be possible to make this
      // logic more complex, but it's reasonable to assume that we'll only get
      // a user deposit in response to `requestUserDeposit`, and further that
      // the same instance of the client that requested the deposit will handle
      // the deposit.
      throw DepositError('Recieved a deposit when none was requested')
    }

    const requestedAmount = requestedDeposit.amount

    const { args } = update
    if (
      args.depositWeiUser != requestedAmount.amountWei ||
      args.depositTokenUser != requestedAmount.amountToken
    ) {
      throw DepositError(`Deposit request does not match requested deposit!`)
    }

    await this.saveRequestedDeposit({
      ...requestedDeposit,
      txCount: update.txCount,
    })

    try {
      if (args.depositTokenUser !== '0') {
        console.log(`Approving transfer of ${args.depositTokenUser} tokens`)
        const token = new this.connext.opts.web3.eth.Contract(
          tokenAbi,
          this.connext.opts.tokenAddress
        )
        let sendArgs: any = {
          from: prev.user,
        }
        const call = token.methods.approve(prev.contractAddress, args.depositTokenUser)
        const gasEstimate = await call.estimateGas(sendArgs)
        sendArgs.gas = this.connext.contract.gasMultiple * gasEstimate
        await call.send(sendArgs)
      }
      console.log('Sending user authorized deposit to chain.')
      const tx = await this.connext.contract.userAuthorizedUpdate(state)
      await tx.awaitEnterMempool()
    } catch (e) {
      const currentChannel = await this.connext.contract.getChannelDetails(prev.user)
      if (update.txCount && currentChannel.txCountGlobal >= update.txCount) {
        // Update has already been sent to chain
        console.log(`Non-critical error encountered processing userAuthorizedUpdate:`, e)
        console.log(
          `Update has already been applied to chain ` +
          `(${currentChannel.txCountGlobal} >= ${update.txCount}), ` +
          `countersigning and returning update.`
        )
        return
      }

      // logic should be retry transaction UNTIL timeout elapses, then 
      // submit the invalidation update
      throw DepositError('Sending userAuthorizedUpdate to chain: ' + e)
    }
  }

}
