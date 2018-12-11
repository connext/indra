import BigNumber from 'bignumber.js'
import { ICurrency } from './currency/Currency'
import CurrencyConvertable from './currency/CurrencyConvertable'
import { ExchangeRates } from '../state/ConnextState/ExchangeRates'

type DecimalPercent = number

const ONE_PERCENT: DecimalPercent = .01
const DEFAULT_DELTA: DecimalPercent = ONE_PERCENT
const VALIDATE_DECIMAL_PERCENT_ERROR = 'delta must be a decimal percent between 0 and 1'

const validateDecimalPercent = (num: number): DecimalPercent => {
  if (num > 1 || num < 0) {
    throw new Error(VALIDATE_DECIMAL_PERCENT_ERROR)
  }
  return num
}

export function isFairExchange(
  rates: ExchangeRates,
  buyAmount: ICurrency,
  sellAmount: ICurrency,
  maxDelta: DecimalPercent = DEFAULT_DELTA
) {
  validateDecimalPercent(maxDelta)

  const actualDelta = new CurrencyConvertable(buyAmount.type, buyAmount.amount, () => rates)
    .to(sellAmount.type)
    .amountBigNumber
    .div(sellAmount.amount)
    .minus(new BigNumber(1))
    .abs()

  return actualDelta.lte(maxDelta)
}
