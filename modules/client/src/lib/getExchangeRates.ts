import { ExchangeRates } from '../state/ConnextState/ExchangeRates'
import { ConnextStore } from '../state/store'

export const GET_EXCHANGE_RATES_ERROR = 'No exchange rates are set'


export default function getExchangeRates(store: ConnextStore): ExchangeRates {
  const rate = store.getState().runtime.exchangeRate
  if (!rate)
    throw new Error(GET_EXCHANGE_RATES_ERROR)

  return rate.rates
}
