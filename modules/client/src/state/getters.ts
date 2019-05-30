import {
  ChannelState,
  convertChannelState,
  convertCustodialBalanceRow,
  convertPayment,
  ExchangeRates,
  Payment,
} from '../types'

import { ConnextState } from './store'

export const GET_UPDATE_REQUEST_TIMEOUT_ERROR = 'No challenge period set'

export const getChannel = (state: ConnextState): ChannelState =>
  state.persistent.channel

export const getCustodialAndChannelBalance = (state: ConnextState): Payment => {
  const { persistent } = state
  const channel = convertChannelState('bn', persistent.channel)
  const custodial = convertCustodialBalanceRow('bn', persistent.custodialBalance)
  const total = {
    amountToken: custodial.balanceToken.add(channel.balanceTokenUser),
    amountWei: custodial.balanceWei.add(channel.balanceWeiUser),
  }
  return convertPayment('str', total)
}

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
