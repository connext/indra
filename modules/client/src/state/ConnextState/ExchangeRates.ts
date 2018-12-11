export type ExchangeRates = {[key: string/* in CurrencyType*/]: string}
export interface ExchangeRateState {
  lastUpdated: Date
  rates: ExchangeRates
}
