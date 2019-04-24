import * as eth from 'ethers';
import uuid = require('uuid')
import log from './util/log'
import Web3 from 'web3'

const util = require('ethereumjs-util')

const LOG = log('AuthManager')

export default interface CRAuthManager {
  generateNonce(): Promise<string>

  checkSignature(address: string, nonce: string, domain: string, signature: string): Promise<string | null>
}

const CHALLENGE_EXPIRY_MS = 1000 * 60 * 2 // 2 hours

export class MemoryCRAuthManager implements CRAuthManager {
  private static ETH_PREAMBLE = '\x19Ethereum Signed Message:\n'

  // TODO: remove
  private static HASH_PREAMBLE = 'SpankWallet authentication message:'

  private web3: Web3

  private nonces: { [s: string]: number } = {}

  constructor (web3: any) {
    this.web3 = web3
  }

  generateNonce (): Promise<string> {
    const nonce = uuid.v4()
    this.nonces[nonce] = Date.now()
    return Promise.resolve(nonce)
  }

  public async checkSignature (address: string, nonce: string, origin: string, signature: string): Promise<string | null> {
    const creation = this.nonces[nonce]
    const keccak256 = (data: string): string => eth.utils.keccak256(eth.utils.toUtf8Bytes(data))

    if (!eth.utils.isHexString(signature)) {
      LOG.error(`Error: Signature must be a valid hex string: ${signature}`)
      return null
    }

    if (!creation) {
      LOG.warn(`Nonce ${nonce} not found.`)
      return null
    }

    let hash, sigAddr
    hash = keccak256(nonce)
    sigAddr = eth.utils.recoverAddress(hash, signature).toLowerCase()

    if (!sigAddr || sigAddr !== address) {
      LOG.warn(`Signature doesn't match new scheme. Expected address: ${address}. Got address: ${sigAddr}.`)

      // For backwards compatibility, TODO: remove until below
      hash = keccak256(`${MemoryCRAuthManager.HASH_PREAMBLE} ${keccak256(nonce)} ${keccak256(origin)}`)
      sigAddr = eth.utils.recoverAddress(hash, signature).toLowerCase()
      let fingerprint = util.toBuffer(String(hash))
      const prefix = util.toBuffer('\x19Ethereum Signed Message:\n')
      const prefixedMsg = util.keccak256(
        Buffer.concat([
          prefix,
          util.toBuffer(String(fingerprint.length)),
          fingerprint,
        ]),
      )
      const res = util.fromRpcSig(signature)
      const pubKey = util.ecrecover(
        util.toBuffer(prefixedMsg),
        res.v,
        res.r,
        res.s,
      )
      const addrBuf = util.pubToAddress(pubKey)
      sigAddr = util.bufferToHex(addrBuf)
      if (!sigAddr || sigAddr !== address) {
        LOG.warn(`Sig doesn't match old scheme either. Expected address: ${address}. Got address: ${sigAddr}.`)
        return null
      }
      // TODO: remove until here

    }

    if (Date.now() - creation > CHALLENGE_EXPIRY_MS) {
      LOG.warn(`Nonce for address ${sigAddr} is expired.`)
      return null
    }

    delete this.nonces[nonce]

    return sigAddr
  }

}
