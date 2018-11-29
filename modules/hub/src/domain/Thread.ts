import { ThreadState } from '../vendor/connext/types'
import { BigNumber } from 'bignumber.js'
import { objValuesBigNumToString, objValuesStringToBigNum } from '../util'

// A single thread state, encompasing exactly the fields which are signed, and
// the two signatures.
export type ThreadStateBigNum = ThreadState<BigNumber>

// TODO: get these from connext
const ThreadStatus = {
  CT_OPEN: 'CT_OPEN',
  CT_IN_DISPUTE: 'CT_IN_DISPUTE',
  CT_CLOSED: 'CT_CLOSED',
}
export type ThreadStatus = keyof typeof ThreadStatus

// A row of the cm_threads table, including the latest state, the status, and
// other fields.
export type ThreadRow<T = string> = {
  id: number
  status: ThreadStatus
  state: ThreadState<T>
  // ... dispute things, open events, etc ...
}

export type ThreadRowBigNum = ThreadRow<BigNumber>

// A row from the cm_thread_updates table, including the row's state, and
// metadata such as the date it was created.
export interface ThreadStateUpdateRow<T = string> {
  id: number
  createdOn: Date
  state: ThreadState<T>
}

export type ThreadStateUpdateRowBigNum = ThreadStateUpdateRow<BigNumber>

export function threadStateBigNumToStr(
  threadState: ThreadStateBigNum,
): ThreadState {
  return objValuesBigNumToString(threadState)
}

export function threadStateUpdateRowBigNumToStr(
  threadUpdate: ThreadStateUpdateRowBigNum,
): ThreadStateUpdateRow {
  return {
    ...threadUpdate,
    state: threadStateBigNumToStr(threadUpdate.state),
  }
}

export function threadRowBigNumToStr(threadRow: ThreadRowBigNum): ThreadRow {
  return {
    ...threadRow,
    state: threadStateBigNumToStr(threadRow.state),
  }
}

export function threadStateStrToBigNum(
  threadState: ThreadState,
): ThreadStateBigNum {
  return objValuesStringToBigNum(threadState, [
    'balanceWeiSender',
    'balanceWeiReceiver',
    'balanceTokenSender',
    'balanceTokenReceiver',
  ])
}

export function threadStateUpdateRowStrToBigNum(
  threadUpdate: ThreadStateUpdateRow,
): ThreadStateUpdateRowBigNum {
  return {
    ...threadUpdate,
    state: threadStateStrToBigNum(threadUpdate.state),
  }
}

export function threadRowStrToBigNum(threadRow: ThreadRow): ThreadRowBigNum {
  return {
    ...threadRow,
    state: threadStateStrToBigNum(threadRow.state),
  }
}
