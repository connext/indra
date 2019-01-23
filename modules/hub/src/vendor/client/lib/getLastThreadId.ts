import { ConnextStore } from "../state/store"

export function getLastThreadId(store: ConnextStore): number {
  return store.getState().persistent.lastThreadId
}
