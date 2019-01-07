import { BigNumber } from 'bignumber.js';

export function fiatToWei(fiat: BigNumber, rate: BigNumber): BigNumber {
  return fiat.times('1e18').div(rate)
}

export function weiToFiat(wei: BigNumber, rate: BigNumber): BigNumber {
  return wei.times(rate).div('1e18')
}
