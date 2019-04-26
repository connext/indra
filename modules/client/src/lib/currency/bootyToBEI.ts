import Currency, { ICurrency } from "./Currency";
import { BigNumber as BN } from 'ethers/utils'
import { BOOTY } from "../constants";
import { Big } from '../../helpers/bn';

export default function bootyToBEI(
  bootyAmount: ICurrency<"BOOTY">|number|string|BN
): Currency<"BEI"> {
  if (
    bootyAmount instanceof BN ||
    typeof bootyAmount === 'number' ||
    typeof bootyAmount === 'string'
  ) {
    return _bootyToBEI(bootyAmount)
  }
  if (bootyAmount instanceof BN) {
    return _bootyToBEI(bootyAmount.toString())
  }
  return _bootyToBEI(bootyAmount.amount)
}

function _bootyToBEI(booty: string|number|BN): Currency<"BEI"> {
  return Currency.BEI(Big(booty).mul(BOOTY.amount))
}
