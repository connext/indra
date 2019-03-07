import { BigNumber } from 'bignumber.js'
import {
  ChannelState,
  ChannelStatus,
  ChannelStateUpdate,
  convertChannelState,
  PaymentArgsBigNumber,
  ExchangeArgsBigNumber,
  DepositArgsBigNumber,
  WithdrawalArgsBigNumber,
  InvalidationReason
} from '../vendor/connext/types'
import {
  objValuesBigNumToString,
  objValuesStringToBigNum,
} from '../util'
import { Utils } from '../vendor/connext/Utils'

// TODO move all to connext?

// A row of the cm_threads table, including the latest state, the status, and
// other fields.
export type ChannelRow<T = string> = {
  id: number
  status: ChannelStatus
  lastUpdateOn: Date
  user: string
  state: ChannelState<T>
  // ... dispute things, open events, etc ...
}

export type ChannelRowBigNum = ChannelRow<BigNumber>

export function channelRowStringToBigNum(r: ChannelRow): ChannelRowBigNum {
  return {
    ...r,
    state: convertChannelState('bignumber', r.state),
  }
}

export function channelRowBigNumToString(r: ChannelRowBigNum): ChannelRow {
  return {
    ...r,
    state: convertChannelState('str', r.state),
  }
}

// includes metadata
export type ChannelStateUpdateRow<T = string> = ChannelStateUpdate<T> & {
  id: number
  createdOn: Date
  channelId?: number
  chainsawId?: number
  invalid?: InvalidationReason
  onchainTxLogicalId?: number
}

export type ChannelStateUpdateRowBigNum = ChannelStateUpdateRow<BigNumber>

export function channelStateUpdateRowBigNumToString(
  update: ChannelStateUpdateRowBigNum,
): ChannelStateUpdateRow {
  return {
    ...update,
    state: convertChannelState('str', update.state),
    args: objValuesBigNumToString(update.args),
  }
}

export function channelStateUpdateRowStringToBigNum(
  update: ChannelStateUpdateRow,
): ChannelStateUpdateRowBigNum {
  let { args } = update
  let argsBigNum
  switch (update.reason) {
    case 'Payment':
      argsBigNum = objValuesStringToBigNum(args, [
        'amountToken',
        'amountWei',
      ]) as PaymentArgsBigNumber
      break
    case 'Exchange':
      argsBigNum = objValuesStringToBigNum(args, [
        'tokensToSell',
        'weiToSell',
      ]) as ExchangeArgsBigNumber
      break
    case 'ProposePendingDeposit':
      argsBigNum = objValuesStringToBigNum(args, [
        'depositWeiHub',
        'depositWeiUser',
        'depositTokenHub',
        'depositTokenUser',
      ]) as DepositArgsBigNumber
      break
    case 'ProposePendingWithdrawal':
      argsBigNum = objValuesStringToBigNum(args, [
        'tokensToSell',
        'weiToSell',
        'depositWeiUser',
        'depositTokenHub',
        'withdrawalWeiHub',
        'withdrawalWeiUser',
        'withdrawalTokenHub',
      ]) as WithdrawalArgsBigNumber
      break
    default:
  }
  return {
    ...update,
    state: convertChannelState('bignumber', update.state),
    args: argsBigNum,
  }
}
