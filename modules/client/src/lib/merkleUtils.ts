import { ethers as eth } from 'ethers'

const { hexlify, padZeros } = eth.utils

export class MerkleUtils {

  ////////////////////////////////////////
  // Public Methods

  public static bufferToHex = (buffer: Buffer): string => {
    return '0x' + buffer.toString('hex')
  }

  public static hexToBuffer = (hexString: string): Buffer => {
    return Buffer.from(hexString.substr(2, hexString.length), 'hex')
  }

  public static isHash = (buffer: Buffer): boolean => {
    return buffer.length === 32 && Buffer.isBuffer(buffer)
  }

  public static marshallState = (inputs: any[]): any => {
    let m = MerkleUtils.getBytes(inputs[0])
    for (let i = 1; i < inputs.length; i++) {
      const x = MerkleUtils.getBytes(inputs[i])
      m += x.substr(2, x.length)
    }
    return m
  }

  ////////////////////////////////////////
  // Private Methods

  private static padBytes32 = (data: string): string => {
    return hexlify(padZeros(data, 32))
  }

  public static getBytes = (input: any): string => {
    if (Buffer.isBuffer(input)) input = '0x' + input.toString('hex')
    if (66 - input.length <= 0) return eth.utils.hexlify(eth.utils.bigNumberify(input))
    return MerkleUtils.padBytes32(eth.utils.hexlify(eth.utils.bigNumberify(input)))
  }

}
