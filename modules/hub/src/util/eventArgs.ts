import { BigNumber } from 'ethers/utils'

const re = /^0+/gi

export function eventArgToAddress(arg: string): string {
  const strip0x = arg.replace('0x', '')
  const slice = strip0x.substring(32 * 2 - 20 * 2, 32 * 2) // take last 20 bytes of 32 byte string
  return `0x${slice}`
}

export function eventArgToBigNum(arg: string): BigNumber {
  // can handle hexstrings
  return new BigNumber(arg)
}

// data arg is a series of 32 byte strings that represent non-indexed arguments
export function dataArgToBytes32(dataArg: string, index: number): string {
  const strip0x = dataArg.replace('0x', '')
  const start = index * 32 * 2 // 2 hex chars = 1 byte, data is broken up into 32 byte chunks
  const slice = strip0x.substring(start, start + 32 * 2)
  return `0x${slice}`
}

export function dataArgToAddress(dataArg: string, index: number): string {
  const data = dataArgToBytes32(dataArg, index)
  const strip0x = data.replace('0x', '')
  const slice = strip0x.substring(32 * 2 - 20 * 2, 32 * 2) // take last 20 bytes of 32 byte string
  return `0x${slice}`
}

export function dataArgToBigNumber(dataArg: string, index: number): BigNumber {
  return new BigNumber(dataArgToBytes32(dataArg, index))
}
