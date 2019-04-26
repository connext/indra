import BN = require('bn.js')

export const WEI_CONVERSION = Big("1000000000000000000") // 1 eth = 10^18 wei

export function Big(n: number | string): BN {
  return new BN(n)
}

export function toWeiBigNum(amount: number | string): BN {
  return Big(amount.toString()).mul(WEI_CONVERSION)
}

export function toWeiString(amount: number | string): string {
  return Big(amount.toString()).mul(WEI_CONVERSION).toString()
}