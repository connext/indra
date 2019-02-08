import { ConnextStore } from "../state/store"

export function getLastThreadUpdateId(store: ConnextStore): number {
  return store.getState().persistent.lastThreadUpdateId
}
