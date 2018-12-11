import { ConnextStore } from "../state/store"
import * as semaphore from 'semaphore'

export function getSem(store: ConnextStore): semaphore.Semaphore {
  return store.getState().runtime.sem
}