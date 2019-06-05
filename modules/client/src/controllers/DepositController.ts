import { ethers as eth } from 'ethers'
import tokenAbi from 'human-standard-token-abi'

import { ConnextInternal } from '../Connext'
import { toBN, validateTimestamp } from '../lib'
import { getLastThreadUpdateId, getTxCount, getUpdateRequestTimeout } from '../state'
import {
  argNumericFields,
  ChannelState,
  Contract,
  insertDefault,
  Payment,
  UpdateRequestTypes,
} from '../types'

import { AbstractController } from './AbstractController'

const gasPriceLifespan: number = 1000 * 60 * 10 // 10 minutes

export interface SuggestedGasPrice {
  expiry: number
  price: string
}

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
export class DepositController extends AbstractController {
  private resolvePendingDepositPromise: any = undefined
  private suggestedGasPrice?: SuggestedGasPrice

  public async requestUserDeposit(args: Partial<Payment>, overrides?: any): Promise<any> {
    if (overrides && overrides.gasPrice) {
      this.suggestedGasPrice = overrides && overrides.gasPrice
        ? {
            expiry: Date.now() + gasPriceLifespan,
            price: toBN(overrides.gasPrice).toHexString(),
          }
        : undefined
    }
    // insert '0' strs to the obj
    const deposit = insertDefault('0', args, argNumericFields.Payment)
    const signedRequest = await this.connext.signDepositRequestProposal(deposit)
    if (!signedRequest.sigUser) {
      this.log.warn(`No signature detected on the deposit request.`)
      return
    }

    try {
      const sync = await this.hub.requestDeposit(
        signedRequest,
        getTxCount(this.store.getState()),
        getLastThreadUpdateId(this.store.getState()),
      )
      this.connext.syncController.handleHubSync(sync)
    } catch (e) {
      this.log.warn(`Error requesting deposit ${e.message}`)
    }

    // There can only be one pending deposit at a time, so it's safe to return
    // a promise that will resolve/reject when we eventually hear back from the
    // hub.
    return new Promise((res: any, rej: any): any => {
      this.resolvePendingDepositPromise = { res, rej }
    })
  }

  /**
   * Given arguments for a user authorized deposit which we want to send
   * to chain, generate a state for that deposit, send that state to chain,
   * and return the state once it has been successfully added to the mempool.
   */
  public async sendUserAuthorizedDeposit(
    prev: ChannelState, update: UpdateRequestTypes['ProposePendingDeposit'],
  ): Promise<any> {
    let check
    try {
      await this._sendUserAuthorizedDeposit(prev, update)
      check = this.resolvePendingDepositPromise && this.resolvePendingDepositPromise.res()
    } catch (e) {
      this.log.warn(
        `Error handling userAuthorizedUpdate (this update will be ` +
        `countersigned and held until it expires - at which point it ` +
        `will be invalidated - or the hub sends us a subsequent ` +
        `ConfirmPending. (update: ${JSON.stringify(update)}; prev: ${JSON.stringify(prev)}) ` +
        `\n${e}`)
      check = this.resolvePendingDepositPromise && this.resolvePendingDepositPromise.rej(e)
    } finally {
      this.resolvePendingDepositPromise = undefined
    }
  }

  private async _sendUserAuthorizedDeposit(
    prev: ChannelState, update: UpdateRequestTypes['ProposePendingDeposit'],
  ): Promise<any> {
    const DepositError = (msg: string): Error =>
      new Error(`${msg} (update: ${JSON.stringify(update)}; prev: ${JSON.stringify(prev)})`)

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
        `(see comments in source)`)
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
        sigUser: args.sigUser,
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

    const maxTimeout = getUpdateRequestTimeout(this.store.getState())
    const tsErr = validateTimestamp(maxTimeout, update.args.timeout)
    if (tsErr) {
      throw DepositError(tsErr)
    }

    this.log.debug(`Suggested gas price: ${JSON.stringify(this.suggestedGasPrice)}`)

    const gasPrice = this.suggestedGasPrice && this.suggestedGasPrice.expiry > Date.now()
      ? this.suggestedGasPrice.price
      : (await this.connext.wallet.provider.getGasPrice()).toHexString()

    this.log.info(`Depositing with gas price: ${eth.utils.formatUnits(gasPrice, 'gwei')} gwei`)

    try {
      if (args.depositTokenUser !== '0') {

        const token = new eth.Contract(
          this.connext.opts.tokenAddress,
          tokenAbi,
          this.connext.wallet,
        )

        const allowance = await token.allowance(
          this.connext.wallet.address,
          prev.contractAddress,
        )

        if (allowance.lt(toBN(args.depositTokenUser))) {

          this.log.info(`Token allowance (${allowance}) is lower than ` +
            `what's needed (${args.depositTokenUser}), approving more`)

          const gasLimit = toBN(Math.ceil((
            await token.estimate.approve(prev.contractAddress, args.depositTokenUser)
          ).toNumber() * 1.5))

          const approveTx = await token.approve(
            prev.contractAddress, args.depositTokenUser, { gasLimit, gasPrice },
          )

          await this.connext.wallet.provider.waitForTransaction(approveTx.hash)

        } else {
          this.log.info(`Token allowance (${allowance}) is higher than ` +
            `what's needed (${args.depositTokenUser}), not approving more`)
        }
      }
      const updateTx = await this.connext.contract.userAuthorizedUpdate(state, { gasPrice })
      this.log.info(`Sent user authorized deposit to chain: ${(updateTx as any).hash}`)
    } catch (e) {
      this.log.info(`Getting channel details for user: ${prev.user}`)
      const currentChannel = await this.connext.contract.getChannelDetails(prev.user)
      if (update.txCount && currentChannel.txCountGlobal >= update.txCount) {
        // Update has already been sent to chain
        this.log.info(`Non-critical error encountered processing userAuthorizedUpdate: ${e}`)
        this.log.info(
          `Update has already been applied to chain ` +
          `(${currentChannel.txCountGlobal} >= ${update.txCount}), ` +
          `countersigning and returning update.`)
        return
      }

      // logic should be retry transaction UNTIL timeout elapses, then
      // submit the invalidation update
      throw DepositError(`Sending userAuthorizedUpdate to chain: ${e}`)
    }
  }

}
