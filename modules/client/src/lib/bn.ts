import { ethers as eth } from 'ethers'
import { BigNumber } from 'ethers/utils'

const { Zero, MaxUint256 } = eth.constants
const { bigNumberify, parseEther, formatEther } = eth.utils

export type BN = BigNumber

export const isBN = BigNumber.isBigNumber

export const toBN = (n: string|number|BN): BN =>
  bigNumberify(n.toString())

export const toWei = (n: string|number|BN): BN =>
  parseEther(n.toString())

export const fromWei = formatEther

export const weiToToken = (wei: BN, tokenPerEth: string): BN =>
  toBN(formatEther(toWei(tokenPerEth).mul(wei)).replace(/\.[0-9]*$/, ''))

export const tokenToWei = (token: BN, tokenPerEth: string): BN =>
  toWei(token).div(toWei(tokenPerEth))

export const maxBN = (lon: BN[]): BN =>
  lon.reduce((max: BN, current: BN): BN => max.gt(current) ? max : current, Zero)

export const minBN = (lon: BN[]): BN =>
  lon.reduce((min: BN, current: BN): BN => min.lt(current) ? min : current, MaxUint256)
