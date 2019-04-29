import { ConnextState } from '../state/store'
import {
 ChannelState,
 ExchangeRates,
 ThreadState,
} from '../types'

export const GET_EXCHANGE_RATES_ERROR = 'No exchange rates are set'
export const GET_UPDATE_REQUEST_TIMEOUT_ERROR = 'No challenge period set'

export function getActiveThreads(state: ConnextState): ThreadState[] {
  return state.persistent.activeThreads
}

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

export function getTxCount(state: ConnextState) {
  return state.persistent.channel.txCountGlobal
}

export function getUpdateRequestTimeout(state: ConnextState): number {
  const challenge = state.runtime.updateRequestTimeout
  if (!challenge) {
    throw new Error(GET_UPDATE_REQUEST_TIMEOUT_ERROR)
  }
  return challenge
}
