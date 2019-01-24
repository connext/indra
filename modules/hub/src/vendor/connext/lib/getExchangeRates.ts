import { ExchangeRates } from '../state/ConnextState/ExchangeRates'
import { ConnextState } from '../state/store'

export const GET_EXCHANGE_RATES_ERROR = 'No exchange rates are set'


export default function getExchangeRates(state: ConnextState): ExchangeRates {
  const rate = state.runtime.exchangeRate
  if (!rate) {
    return { }
  }

  return rate.rates
}
