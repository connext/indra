import { ConnextStore } from '../state/store'
import getChallengePeriod from './getChallengePeriod';

export function validateTimestamp(store: ConnextStore, timeout: number) {
  const challenge = getChallengePeriod(store)
  const now = Math.floor(Date.now() / 1000)
  const delta = timeout - now
  if (delta > challenge || delta < 0) {
    // TODO: send an invalidating state back to the hub (REB-12)
    return (
      `Proposed timestamp '${timeout}' is too far from now ('${now}')` +
      `by ${delta}s (with challenge of '${challenge}s)'`
    )
  }
}
