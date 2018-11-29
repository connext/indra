import { BigNumber } from 'bignumber.js'
import {
  ChannelUpdateReason,
  ChannelState,
  ChannelStatus,
} from '../vendor/connext/types'
import { objValuesBigNumToString, objValuesStringToBigNum } from '../util'

// A single channel state, encompasing exactly the fields which are signed, and
// the two signatures.
export type ChannelStateBigNum = ChannelState<BigNumber>

// A row of the cm_threads table, including the latest state, the status, and
// other fields.
export type ChannelRow<T = string> = {
  id: number
  status: ChannelStatus
  state: ChannelState<T>
  // ... dispute things, open events, etc ...
}

export type ChannelRowBigNum = ChannelRow<BigNumber>

// includes metadata
export interface ChannelStateUpdateRow<T = string> {
  id: number
  state: ChannelState<T>
  reason: ChannelUpdateReason
  channelId?: number
  chainsawId?: number
  createdOn: Date
}

export type ChannelStateUpdateRowBigNum = ChannelStateUpdateRow<BigNumber>

export function channelStateBigNumToString(
  s: ChannelStateBigNum,
): ChannelState {
  return objValuesBigNumToString(s)
}

export function channelStateUpdateRowBigNumToString(
  update: ChannelStateUpdateRowBigNum,
): ChannelStateUpdateRow {
  return {
    ...update,
    state: channelStateBigNumToString(update.state),
  }
}

export function channelRowBigNumToString(r: ChannelRowBigNum): ChannelRow {
  return {
    ...r,
    state: channelStateBigNumToString(r.state),
  }
}

export function channelStateStringToBigNum(
  s: ChannelState,
): ChannelStateBigNum {
  return objValuesStringToBigNum(s, [
    'balanceWeiHub',
    'balanceWeiHub',
    'balanceWeiUser',
    'balanceTokenHub',
    'balanceTokenUser',
    'pendingDepositWeiHub',
    'pendingDepositWeiUser',
    'pendingDepositTokenHub',
    'pendingDepositTokenUser',
    'pendingWithdrawalWeiHub',
    'pendingWithdrawalWeiUser',
    'pendingWithdrawalTokenHub',
    'pendingWithdrawalTokenUser',
  ])
}

export function channelStateUpdateRowStringToBigNum(
  update: ChannelStateUpdateRow,
): ChannelStateUpdateRowBigNum {
  return {
    ...update,
    state: channelStateStringToBigNum(update.state),
  }
}

export function channelRowStringToBigNum(r: ChannelRow): ChannelRowBigNum {
  return {
    ...r,
    state: channelStateStringToBigNum(r.state),
  }
}

// class ChannelStateClass implements ChannelState<BigNumber> {

// }
