import { ExchangeRates } from '../state/ConnextState/ExchangeRates'
import { CurrencyType } from '../state/ConnextState/CurrencyTypes'

type BigString = string

// NOTE: only used in testing
// usdRate is the price of 1 ETH in USD
export default function generateExchangeRates(usdRate: BigString): ExchangeRates {
  return {
    [CurrencyType.USD]: usdRate,
    [CurrencyType.BOOTY]: usdRate,
    [CurrencyType.BEI]: usdRate + '000000000000000000',
    [CurrencyType.ETH]: '1',
    [CurrencyType.WEI]: '1000000000000000000',
    [CurrencyType.FINNEY]: '1000',
  }
}
