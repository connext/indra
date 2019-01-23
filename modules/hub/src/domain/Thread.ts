import { ThreadState, ThreadStatus } from '../vendor/client/types'
import { BigNumber } from 'bignumber.js'

// A single thread state, encompasing exactly the fields which are signed, and
// the two signatures.
export type ThreadStateBigNum = ThreadState<BigNumber>

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
