import { ConnextState } from "../state/store";
//import JsonRpcServer from '../lib/messaging/JsonRpcServer'
//import { DepositRequest } from '../lib/rpc/yns'
import Logger from '../lib/Logger'
import takeSem from '../lib/takeSem'
import { Connext } from '../Connext'
import getTxCount from '../lib/getTxCount'
import getAddress from '../lib/getAddress'
import * as actions from '../state/actions'
import { ChannelUpdateReasons, Payment, SyncResult } from '../types'
import { getLastThreadId } from '../lib/getLastThreadId'
import { syncEnqueueItems } from '../lib/syncEnqueueItems'
import { getSem } from '../lib/getSem'
import { AbstractController } from "./AbstractController";

export const SEMAPHORE_ERROR = 'Cannot deposit while another operation is in progress'
export const INCORRECT_PENDING_AMOUNT = 'User pending deposit balances do not match users requested deposit amount'

export default class DepositController extends AbstractController {
  public requestUserDeposit = async (deposit: Payment): Promise<void> => {
    console.log('requestUserDeposit')
    if (!getSem(this.store).available(1)) {
      throw new Error(SEMAPHORE_ERROR)
    }

    if (this.getState().runtime.hasActiveDeposit) {
      // TODO make the semaphore handle this for us in a cleaner way
      throw new Error('Still waiting on an active deposit!')
    }

    this.setHasActiveDeposit(true)
    this.logToApi('requestUserDeposit', { deposit, user: getAddress(this.store), txCount: getTxCount(this.store) })

    try {
      await takeSem<void>(getSem(this.store), async () => {
        const updates = [await this.doRequestUserDeposit(deposit)]
        this.sendToQueue(updates, deposit)
      })
    } catch (e) {
      console.error('there was an error requesting deposit from hub', { e, deposit, user: getAddress(this.store), txCount: getTxCount(this.store) })
      this.setHasActiveDeposit(false)
      throw e
    }
  }

  private doRequestUserDeposit = async (payment: Payment): Promise<SyncResult> => {
    console.log('connext.requestDeposit')
    return this.legacyConnext.requestDeposit(
      payment,
      getTxCount(this.store),
      getLastThreadId(this.store),
      getAddress(this.store)
    )
  }

  private sendToQueue = (updates: SyncResult[], deposit: Payment) => {
    const latest = updates[updates.length - 1]

    if (latest.type !== 'channel') {
      throw new Error('expected a channel update')
    }

    const isValidType = (
      latest.state.reason == ChannelUpdateReasons.ProposePendingDeposit ||
      latest.state.reason == ChannelUpdateReasons.ProposePendingWithdrawal
    )
    if (isValidType)
      throw new Error('expected a propose pending update, got: ' + latest.state.reason)

    if (
      latest.state.state.pendingDepositTokenUser !== deposit.amountToken ||
      latest.state.state.pendingDepositWeiUser !== deposit.amountWei
    ) {
      this.logToApi('requestUserDeposit', { message: INCORRECT_PENDING_AMOUNT, deposit, user: getAddress(this.store), txCount: getTxCount(this.store) })
      throw new Error(INCORRECT_PENDING_AMOUNT)
    }

    syncEnqueueItems(this.store, updates)
  }

  private setHasActiveDeposit = (hasActiveDeposit: boolean) => {
    this.store.dispatch(
      actions.setHasActiveDeposit(hasActiveDeposit)
    )
  }
}
