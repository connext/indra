import { ConnextStore } from '../state/store'

export const GET_UPDATE_REQUEST_TIMEOUT_ERROR = 'No challenge period set'

export function getUpdateRequestTimeout(store: ConnextStore): number {
  const challenge = store.getState().runtime.updateRequestTimeout
  if (!challenge)
    throw new Error(GET_UPDATE_REQUEST_TIMEOUT_ERROR)

  return challenge
}
