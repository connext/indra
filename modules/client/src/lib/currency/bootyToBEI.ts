import Currency, { ICurrency } from "./Currency";
import { BigNumber as BN } from 'ethers/utils'
import { BOOTY } from "../constants";
import BigNumber from "bignumber.js";

export default function bootyToBEI(
  bootyAmount: ICurrency<"BOOTY">|number|string|BN|BigNumber
): Currency<"BEI"> {
  if (
    bootyAmount instanceof BigNumber ||
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

function _bootyToBEI(booty: string|number|BigNumber): Currency<"BEI"> {
  return Currency.BEI(new BigNumber(booty.toString()).times(BOOTY.amount))
}
