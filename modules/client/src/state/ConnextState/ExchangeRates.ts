import { CurrencyType } from '../ConnextState/CurrencyTypes'
import { BigNumber } from 'bignumber.js'

export type ExchangeRates = {
  [key in CurrencyType]?: string | BigNumber
}

export interface ExchangeRateState {
  lastUpdated: Date
  rates: ExchangeRates
}
