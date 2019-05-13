import { ConnextState } from '../state/store'
import {
 ChannelState,
 ExchangeRates,
} from '../types'

export const GET_UPDATE_REQUEST_TIMEOUT_ERROR = 'No challenge period set'

export function getChannel(state: ConnextState): ChannelState {
  return state.persistent.channel
}

export function getExchangeRates(state: ConnextState): ExchangeRates {
  const rate = state.runtime.exchangeRate
  return rate && rate.rates ? rate.rates : {}
}

export function getLastThreadUpdateId(state: ConnextState): number {
  return state.persistent.lastThreadUpdateId
}

export function getTxCount(state: ConnextState): number {
  return state.persistent.channel.txCountGlobal
}

export function getUpdateRequestTimeout(state: ConnextState): number {
  const challenge = state.runtime.updateRequestTimeout
  if (challenge) { return challenge }
  throw new Error(GET_UPDATE_REQUEST_TIMEOUT_ERROR)
}
