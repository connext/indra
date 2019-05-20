import { ConnextState } from '../state/store'
import {
 ChannelState,
 ExchangeRates,
} from '../types'

export const GET_UPDATE_REQUEST_TIMEOUT_ERROR = 'No challenge period set'

export const getChannel = (state: ConnextState): ChannelState =>
  state.persistent.channel

export const getExchangeRates = (state: ConnextState): ExchangeRates => {
  const rate = state.runtime.exchangeRate
  return rate && rate.rates ? rate.rates : {}
}

export const getLastThreadUpdateId = (state: ConnextState): number =>
  state.persistent.lastThreadUpdateId

export const getTxCount = (state: ConnextState): number =>
  state.persistent.channel.txCountGlobal

export const getUpdateRequestTimeout = (state: ConnextState): number => {
  const challenge = state.runtime.updateRequestTimeout
  if (challenge) { return challenge }
  throw new Error(GET_UPDATE_REQUEST_TIMEOUT_ERROR)
}
