import * as eth from 'ethers'
import { BigNumber } from 'ethers/utils'

export type BN = BigNumber

export const isBN = BigNumber.isBigNumber

export const toBN = (n: string|number|BN): BN =>
  eth.utils.bigNumberify(n.toString())

export const toWei = (n: string|number|BN): BN =>
  eth.utils.parseEther(n.toString())

export const fromWei = (n: BN): string =>
  eth.utils.formatEther(n)

export const weiToToken = (wei: BN, tokenPerEth: string): BN =>
  toBN(eth.utils.formatEther(toWei(tokenPerEth).mul(wei)).slice(0, -2))

export const tokenToWei = (token: BN, tokenPerEth: string): BN =>
  toWei(token).div(toWei(tokenPerEth))

export const maxBN = (lon: BN[]): BN =>
  lon.reduce((max, current) => max.gt(current) ? max : current, eth.constants.Zero)

export const minBN = (lon: BN[]): BN =>
  lon.reduce((min, current) => min.lt(current) ? min : current, eth.constants.MaxUint256)
