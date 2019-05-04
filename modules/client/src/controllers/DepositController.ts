import { ethers as eth } from 'ethers';
import { AbstractController } from './AbstractController';
import { getTxCount, getLastThreadUpdateId } from '../state/getters'
import { validateTimestamp } from '../lib/timestamp';
import {
  ChannelState,
  Payment,
  UpdateRequestTypes,
  insertDefault,
  argNumericFields,
} from '../types'
const tokenAbi = require('human-standard-token-abi')

/*
 * Rule:
 * - Lock needs to be held any time we're requesting sync from the hub
 * - We can send updates to the hub any time we want (because the hub will
 *   reject them if they are out of sync)
 * - In the case of deposit, the `syncController` will expose a method
 *   called something like "tryHandleHubSync", which will add the
 *   sync results if the lock isn't held, but ignore them otherwise (ie,
 *   because they will be picked up on the next sync anyway), and this method
 *   will be used by the DepositController.
 */
export default class DepositController extends AbstractController {
  private resolvePendingDepositPromise: any = null

  public async requestUserDeposit(args: Partial<Payment>) {
    // insert '0' strs to the obj
    const deposit = insertDefault('0', args, argNumericFields.Payment)
    const signedRequest = await this.connext.signDepositRequestProposal(deposit)
    
    try {
      const sync = await this.hub.requestDeposit(
        signedRequest,
        getTxCount(this.store.getState()),
        getLastThreadUpdateId(this.store.getState())
      )
      this.connext.syncController.handleHubSync(sync)
    } catch (e) {
      console.warn('Error requesting deposit', e)
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
        `ConfirmPending. (update: ${JSON.stringify(update)}; prev: ${JSON.stringify(prev)})`, e
      )
      this.resolvePendingDepositPromise && this.resolvePendingDepositPromise.rej(e)
    } finally {
      this.resolvePendingDepositPromise = null
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

    const { args } = update

    // throw a deposit error if the signer is not correct on update
    if (!args.sigUser) {
      throw DepositError(`Args are unsigned, not submitting a userAuthorizedUpdate to chain.`)
    }

    try {
      this.connext.validator.assertDepositRequestSigner({
        amountToken: args.depositTokenUser,
        amountWei: args.depositWeiUser,
        sigUser: args.sigUser
      }, prev.user)
    } catch (e) {
      throw DepositError(e.message)
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


    try {
      if (args.depositTokenUser !== '0') {
        console.log(`Approving transfer of ${args.depositTokenUser} tokens`)
        const token = new eth.Contract(
          this.connext.opts.tokenAddress!,
          tokenAbi,
          this.connext.wallet,
        )
        const overrides: any = { }
        const gasEstimate = (await token.estimate.approve(prev.contractAddress, args.depositTokenUser)).toNumber()
        overrides.gasLimit = eth.utils.bigNumberify(Math.ceil(gasEstimate * this.connext.contract.gasMultiple))
        overrides.gasPrice = await this.connext.wallet.provider.getGasPrice()
        const tx = await token.approve(prev.contractAddress, args.depositTokenUser, overrides)
        await this.connext.wallet.provider.waitForTransaction(tx.hash)
      }
      const tx = await this.connext.contract.userAuthorizedUpdate(state)
      console.log(`Sent user authorized deposit to chain: ${(tx as any).hash}`)
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
