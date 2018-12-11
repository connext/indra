import { ConnextStore } from "../state/store"
import * as actions from '../state/actions'
import getTxCount from './getTxCount'
import {ChannelStateUpdate, SyncResult} from '../types'
import {getLastThreadId} from './getLastThreadId'

export function syncEnqueueItems(store: ConnextStore, syncItems: SyncResult[]): void {
  const currentQueue = store.getState().runtime.syncQueue

  let latestQueuedTxCount = 0
  for (let i = currentQueue.length - 1; i >= 0; i--) {
    const item = currentQueue[i]
    if (item.type === 'thread') {
      continue
    }

    latestQueuedTxCount = item.state.state.txCountGlobal
    break
  }


  const latestTxCount = getTxCount(store)
  const latestThreadId = getLastThreadId(store)

  const newItems = syncItems.filter(item => {
    if (item.type === 'thread' && item.state.state.threadId > latestThreadId) {
      return true
    }

    const currCount = (item.state as ChannelStateUpdate).state.txCountGlobal
    return currCount > latestTxCount && currCount > latestQueuedTxCount
  })

  if (newItems.length === 0) {
    return
  }

  store.dispatch(
    actions.enqueueSyncItems(
      newItems
    )
  )
}
