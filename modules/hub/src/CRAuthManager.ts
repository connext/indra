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

    if (!creation) {
      LOG.warn(`Nonce ${nonce} not found.`)
      return null
    }

    const hash = this.sha3(`${MemoryCRAuthManager.HASH_PREAMBLE} ${this.sha3(nonce)} ${this.sha3(origin)}`)
    const sigAddr = this.extractAddress(hash, signature)

    if (!sigAddr || sigAddr !== address) {
      LOG.warn(`Received invalid signature. Expected address: ${address}. Got address: ${sigAddr}.`)
      return null
    }

    if (Date.now() - creation > CHALLENGE_EXPIRY_MS) {
      LOG.warn(`Nonce for address ${sigAddr} is expired.`)
      return null
    }

    delete this.nonces[nonce]

    return sigAddr
  }

  private extractAddress (hash: string, signature: string): string | null {
    LOG.debug(`Hash sent to extract: ${hash}`)
    let addr

    try {
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
      addr = util.bufferToHex(addrBuf)
    } catch (e) {
      LOG.warn('Caught error trying to recover public key:', e)
      return null
    }

    return addr
  }

  private sha3 (data: string): string {
    return this.web3.utils.sha3(data)
  }
}
