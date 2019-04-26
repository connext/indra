import { ethers } from 'ethers';

export function Big(n: number | string): ethers.utils.BigNumber {
  return ethers.utils.bigNumberify(n)
}

export function toWeiBigNum(amount: number | string): ethers.utils.BigNumber {
  return ethers.utils.parseEther(amount.toString())
}

export function toWeiString(amount: number | string): string {
  return ethers.utils.parseEther(amount.toString()).toString()
}
