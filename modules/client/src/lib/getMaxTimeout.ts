import { ConnextStore } from '../state/store'

export const GET_CHALLENGE_PERIOD_ERROR = 'No challenge period set'


export default function getChallengePeriod(store: ConnextStore): number {
  const challenge = store.getState().persistent.challengePeriod
  if (!challenge)
    throw new Error(GET_CHALLENGE_PERIOD_ERROR)

  return challenge
}