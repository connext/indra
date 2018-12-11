import * as constants from './constants'
import { BigNumber } from 'bignumber.js'
import { ExchangeRates } from '../state/ConnextState/ExchangeRates'
import { CurrencyType } from '../state/ConnextState/CurrencyTypes'

type BigString = string

export default function generateExchangeRates(usdRate: BigString): ExchangeRates {
  const USD_RATE: string = new BigNumber(constants.ETHER.toString(10))
    .div(usdRate)
    .toString(10)

  const BEI_RATE: string = new BigNumber(USD_RATE)
    .div(constants.BOOTY.amount)
    .toString(10)

  return {
    [CurrencyType.USD]: USD_RATE,
    [CurrencyType.BOOTY]: USD_RATE,
    [CurrencyType.BEI]: BEI_RATE,
    [CurrencyType.ETH]: constants.ETHER.toString(10),
    [CurrencyType.WEI]: '1',
    [CurrencyType.FINNEY]: constants.FINNEY.toString(10),
   }
}
