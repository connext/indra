const Web3 = require('web3')

export class MerkleUtils {
  static getBytes = (input: any): string => {
    if (Buffer.isBuffer(input)) input = '0x' + input.toString('hex')
    if (66 - input.length <= 0) return Web3.utils.toHex(input)
    return MerkleUtils.padBytes32(Web3.utils.toHex(input))
  }

  static marshallState = (inputs: any[]): any => {
    var m = MerkleUtils.getBytes(inputs[0])

    for (var i = 1; i < inputs.length; i++) {
      let x = MerkleUtils.getBytes(inputs[i])
      m += x.substr(2, x.length)
    }
    return m
  }

  static getCTFaddress = (_r: any): string => {
    return Web3.utils.sha3(_r, { encoding: 'hex' })
  }

  static getCTFstate = (_contract: any, _signers: any, _args: any): any => {
    _args.unshift(_contract)
    var _m = MerkleUtils.marshallState(_args)
    _signers.push(_contract.length)
    _signers.push(_m)
    var _r = MerkleUtils.marshallState(_signers)
    return _r
  }

  static padBytes32 = (data: any): string => {
    // TODO: check input is hex / move to TS
    let l = 66 - data.length

    let x = data.substr(2, data.length)

    for (var i = 0; i < l; i++) {
      x = 0 + x
    }
    return '0x' + x
  }

  static rightPadBytes32 = (data: any): string => {
    let l = 66 - data.length

    for (var i = 0; i < l; i++) {
      data += 0
    }
    return data
  }

  static hexToBuffer = (hexString: string): Buffer => {
    return new Buffer(hexString.substr(2, hexString.length), 'hex')
  }

  static bufferToHex = (buffer: Buffer): string => {
    return '0x' + buffer.toString('hex')
  }

  static isHash = (buffer: Buffer): Boolean => {
    return buffer.length === 32 && Buffer.isBuffer(buffer)
  }
}
