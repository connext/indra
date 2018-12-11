import { AbstractController } from './AbstractController'
import getTxCount from '../lib/getTxCount'
import getAddress from '../lib/getAddress'
import { getSem } from '../lib/getSem'
import * as actions from '../state/actions'
import takeSem from '../lib/takeSem'
import {
  Payment,
  SyncResult,
  ChannelUpdateReasons,
  ChannelStateUpdate,
  UnsignedChannelState,
  channelStateToChannelStateUpdate,
  convertChannelState,
  PaymentBN,
  convertPayment,
  WithdrawalArgsBN,
  WithdrawalArgs,
  convertWithdrawal,
} from '../types'
import { syncEnqueueItems } from '../lib/syncEnqueueItems'
import { getLastThreadId } from '../lib/getLastThreadId'
import * as BigNumber from 'bignumber.js'
import { getChannel } from '../lib/getChannel'
import { diffUpdates } from '../lib/diffUpdates'
import Currency, { ICurrency } from '../lib/currency/Currency'
import { mul, add, sub, gte } from '../lib/math'
import { isFairExchange } from '../lib/isFairExchange'
import getExchangeRates from '../lib/getExchangeRates'

export const SEMAPHORE_ERROR = 'Cannot withdraw while another operation is in progress'
export const INCORRECT_PENDING_AMOUNT = 'User pending withdrawal balances do not match users requested withdrawal amount'
export const INCORRECT_RECIPIENT = 'User pending withdrawal recipient does not match users intended withdrawal recipient'
export const INCORRECT_EXCHANGE = 'Unfair exchange proposed by hub on withdrawal'

export default class WithdrawalController extends AbstractController {
  public requestUserWithdrawal = async (withdrawal: Payment, recipient: string): Promise<void> => {
    // TODO take floor in react component instead

    console.log('requestUserWithdrawal', { recipient, withdrawal })
    if (!getSem(this.store).available(1)) {
      throw new Error(SEMAPHORE_ERROR)
    }

    if (this.store.getState().runtime.hasActiveWithdrawal) {
      // TODO make the semaphore handle this for us in a cleaner way
      throw new Error('Still waiting on an active withdrawal!')
    }

    this.setHasActiveWithdrawal(true)
    this.logToApi('requestUserWithdrawal', { withdrawal, user: getAddress(this.store), txCount: getTxCount(this.store) })

    try {
      await takeSem<void>(getSem(this.store), async () => {
        const updates = await this.doRequestUserWithdrawal(withdrawal, recipient)
        this.sendToQueue(updates, withdrawal, recipient)
      })
    } catch (e) {
      console.error('there was an error requesting withdrawal from hub', { e, withdrawal, user: getAddress(this.store), txCount: getTxCount(this.store) })
      this.setHasActiveWithdrawal(false)
      throw e
    }
  }

  private doRequestUserWithdrawal = async (withdrawal: Payment, recipient: string): Promise<SyncResult[]> => {
    // wei == amount wei withdrawing from channel
    // token == amount token withdrawing from channel
    console.log('connext.requestWithdrawal')
    const withdrawBN = convertPayment('bn', withdrawal)
    const previousBN = convertChannelState('bn', getChannel(this.store))
    if (
      previousBN.balanceWeiUser.lt(withdrawBN.amountWei) || previousBN.balanceWeiUser.lt(withdrawBN.amountToken)
    ) {
      throw new Error(`Cannot withdraw more than channel balance`)
    }

    const args = await this.hub.requestWithdrawal(
      withdrawal,
      recipient,
    )
    return [await this.argsToSyncResult(args)]
  }

  private sendToQueue = async (updates: SyncResult[], withdrawal: Payment, recipient: string) => {
    const latest = updates[updates.length - 1]

    if (latest.type !== 'channel') {
      throw new Error('expected a channel update')
    }

    if (latest.state.reason !== ChannelUpdateReasons.ProposePendingWithdrawal) {
      throw new Error('expected a propose pending update')
    }

    // recipient is entered propoerly
    if (latest.state.state.recipient !== recipient) {
      this.logToApi('requestUserWithdrawal', { message: INCORRECT_RECIPIENT, withdrawal, recipient, user: getAddress(this.store), txCount: getTxCount(this.store) })
      throw new Error(INCORRECT_RECIPIENT)
    }

    const isExchanging = withdrawal.amountToken !== '0'
    if (isExchanging) {
      // valid exchange for token withdrawal
      const err = await this.isValidExchange(withdrawal, latest.state.state)
      if (err) {
        this.logToApi('requestUserWithdrawal', { message: err, withdrawal, recipient, user: getAddress(this.store), txCount: getTxCount(this.store) })
        throw new Error(err)
      }
    }

    // user pending withdrawals entered properly
    // token withdrawals converted to wei at hub
    if (
      latest.state.state.pendingWithdrawalTokenUser !== '0' &&
      !gte(latest.state.state.pendingWithdrawalWeiUser, withdrawal.amountWei)
    ) {
      // TODO: does not validate exact pendingWithdrawalWei
      // validates the exchange amount in isFairExchange, and ensures
      // withdrawal is >= pending (pending = delta + withdrawal)
      this.logToApi('requestUserWithdrawal', { message: INCORRECT_PENDING_AMOUNT, withdrawal, recipient, user: getAddress(this.store), txCount: getTxCount(this.store) })
      throw new Error(INCORRECT_PENDING_AMOUNT)
    }

    syncEnqueueItems(this.store, updates)
  }

  private isValidExchange = async (withdrawal: Payment, current: UnsignedChannelState) => {
    const previous = getChannel(this.store)
    const rates = getExchangeRates(this.store)
    const diffs = diffUpdates(
      await this.connext.signChannelState(current),
      previous
    )

    this.logToApi('isValidExchange', { diffs, previous, current })

    // sell amount is token in withdrawal
    const sellAmount: ICurrency = Currency.BEI(mul(withdrawal.amountToken, '-1'))
    // wei exchanged from current hub wei balance
    // prev.balanceWeiHub = curr.balanceWeiHub + curr.pendingWithdrawalWeiHub + (exchangedWeiInChannel)
    const weiExchanged = add(sub(diffs.balanceWeiHub, current.pendingWithdrawalWeiHub), diffs.pendingDepositWeiUser)
    const buyAmount: ICurrency = Currency.WEI(weiExchanged)

    const delta = .02

    if (!isFairExchange(rates, buyAmount, sellAmount, delta)) {
      return `Exchange is not within delta of ${delta}`
    }

    return null
  }

  private setHasActiveWithdrawal = (hasActiveWithdrawal: boolean) => {
    this.store.dispatch(
      actions.setHasActiveWithdrawal(hasActiveWithdrawal)
    )
  }

  private argsToSyncResult = async (args: WithdrawalArgsBN): Promise<SyncResult> => {
    // TODO: add metadata
    const state = this.stateGenerator.proposePendingWithdrawal(
      convertChannelState('bn', getChannel(this.store)),
      args,
    )

    return {
      type: "channel",
      state: channelStateToChannelStateUpdate(
        "ProposePendingWithdrawal",
        await this.connext.signChannelState(state),
        convertWithdrawal('str', args),
      )
    }
  }
}
