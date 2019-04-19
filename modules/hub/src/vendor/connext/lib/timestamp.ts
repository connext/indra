import { ConnextStore } from '../state/store'
import { getUpdateRequestTimeout } from '../state/getters';

export function validateTimestamp(store: ConnextStore, timeout: number) {
  // timeout will be 0 for request collateral
  if (timeout === 0) {
    return
  }

  const maxTimeout = getUpdateRequestTimeout(store.getState())
  const now = Math.floor(Date.now() / 1000)
  const delta = timeout - now
  const allowableClockDrift = maxTimeout * 1.5
  if (delta > maxTimeout + allowableClockDrift || delta < 0) {
    // TODO: send an invalidating state back to the hub (REB-12)
    return (
      `Proposed timestamp '${timeout}' is too far from now ('${now}') ` +
      `by ${delta}s (with maxTimeout of '${maxTimeout}s)'`
    )
  }
}
