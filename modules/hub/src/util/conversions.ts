import { BigNumber } from 'bignumber.js';

export function fiatToWei(fiat: BigNumber, rate: BigNumber): BigNumber {
  return fiat.dividedBy(rate).mul('1e18').floor()
}

export function weiToFiat(wei: BigNumber, rate: BigNumber): BigNumber {
  return wei.dividedBy('1e18').mul(rate)
}
