import * as eth from 'ethers';
import { BigNumber } from 'ethers/utils'

const { arrayify, bigNumberify, hexDataLength, hexDataSlice, hexlify, stripZeros, } = eth.utils

// Adds the 0x hex prefix if it doesn't already exist, otherwise noop
const prefix = (hex: string): string => `0x${hex.replace('0x', '')}`

export function eventArgToAddress(arg: string): string {
  return hexDataSlice(prefix(arg), hexDataLength(prefix(arg)) - 20) // extract last 20 bytes
}

export function eventArgToBigNum(arg: string): BigNumber {
  return bigNumberify(prefix(arg))
}

// data arg is a series of 32 byte strings that represent non-indexed arguments
export function dataArgToBytes32(dataArg: string, index: number): string {
  return hexDataSlice(prefix(dataArg), index, index + 32)
}

export function dataArgToAddress(dataArg: string, index: number): string {
  return hexDataSlice(prefix(dataArg), index + 12, index + 32)
}

export function dataArgToBigNumber(dataArg: string, index: number): BigNumber {
  return eth.utils.bigNumberify(dataArgToBytes32(dataArg, index))
}
