import { ethers as eth } from 'ethers'

import { CurrencyType, ExchangeRates } from '../types'

// NOTE: only used in testing
// daiRate is the number of DAI that equals the value of 1 ETH
export const generateExchangeRates = (daiRate: string): ExchangeRates => ({
  [CurrencyType.DAI]: daiRate,
  [CurrencyType.DEI]: eth.utils.parseEther(daiRate).toString(),
  [CurrencyType.ETH]: '1',
  [CurrencyType.FIN]: `1${'0'.repeat(3)}`,
  [CurrencyType.WEI]: `1${'0'.repeat(18)}`,
})
