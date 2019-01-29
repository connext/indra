import { BigNumber } from "bignumber.js";

export function Big(n: any): BigNumber {
  return new BigNumber(n)
}