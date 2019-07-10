import { ethers as eth } from 'ethers'

const { Zero, MaxUint256 } = eth.constants
const { bigNumberify, parseEther, formatEther } = eth.utils

export const isBN = eth.utils.BigNumber.isBigNumber

export const toBN = (n) =>
  bigNumberify(n.toString())

export const toWei = (n) =>
  parseEther(n.toString())

export const fromWei = formatEther

export const weiToToken = (wei, tokenPerEth) =>
  toBN(formatEther(toWei(tokenPerEth).mul(wei)).replace(/\.[0-9]*$/, ''))

export const tokenToWei = (token, tokenPerEth) =>
  toWei(token).div(toWei(tokenPerEth))

export const maxBN = (lon) =>
  lon.reduce((max, current) => max.gt(current) ? max : current, Zero)

export const minBN = (lon) =>
  lon.reduce((min, current) => min.lt(current) ? min : current, MaxUint256)

