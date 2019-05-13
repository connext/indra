import { ExchangeRates } from '../types'
import { CurrencyType } from '../lib/currency'

// NOTE: only used in testing
// daiRate is the number of DAI that equals the value of 1 ETH
export function generateExchangeRates(daiRate: string): ExchangeRates {
  return {
    [CurrencyType.DAI]: daiRate,
    [CurrencyType.ETH]: '1',
    [CurrencyType.FIN]: `1${'0'.repeat(3)}`,
    [CurrencyType.WEI]: `1${'0'.repeat(18)}`,
  }
}

export default generateExchangeRates
