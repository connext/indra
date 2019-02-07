import { ConnextStore } from '../state/store'
import { ThreadState } from '../types'

export function getActiveThreads(store: ConnextStore): ThreadState[] {
  return store.getState().persistent.activeThreads
}
