import { CurrencyType } from '../../state/ConnextState/CurrencyTypes'
import Currency, { ICurrency } from "./Currency";
import BN = require('bn.js')
import { BOOTY } from "../constants";
import { BigNumber } from 'bignumber.js'

export default function bootyToBEI(
  bootyAmount: ICurrency<CurrencyType.BOOTY>|number|string|BN|BigNumber
): Currency<CurrencyType.BEI> {
  if (
    bootyAmount instanceof BigNumber ||
    typeof bootyAmount === 'number' ||
    typeof bootyAmount === 'string'
  ) {
    return _bootyToBEI(bootyAmount)
  }
  if (bootyAmount instanceof BN) {
    return _bootyToBEI(bootyAmount.toString(10))
  }
  return _bootyToBEI(bootyAmount.amount)
}

function _bootyToBEI(booty: string|number|BigNumber): Currency<CurrencyType.BEI> {
  return Currency.BEI(new BigNumber(booty).times(BOOTY.amount))
}
