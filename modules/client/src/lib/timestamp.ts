import { ConnextStore } from '../state/store'
import getMaxTimeout from './getMaxTimeout';

export function validateTimestamp(store: ConnextStore, timeout: number) {
  // timeout will be 0 for request collateral
  if (timeout === 0) {
    return
  }

  const challenge = getMaxTimeout(store)
  const now = Math.floor(Date.now() / 1000)
  const delta = timeout - now
  if (delta > challenge || delta < 0) {
    // TODO: send an invalidating state back to the hub (REB-12)
    return ( null
      // `Proposed timestamp '${timeout}' is too far from now ('${now}')` +
      // `by ${delta}s (with challenge of '${challenge}s)'`
    )
  }
}
