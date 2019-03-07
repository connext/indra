import { BigNumber } from 'bignumber.js'

export function Big(n: number | string): BigNumber {
  return new BigNumber(n)
}

export function toWeiBigNum(amount: number | string): BigNumber {
  return Big(amount).times(1e18)
}

export function toWeiString(amount: number | string): string {
  return Big(amount).times(1e18).toFixed()
}
