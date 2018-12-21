import uuid = require('uuid')
import log from './util/log'

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

  private web3: any

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
    const normalizedAddress = address.toLowerCase()

    if (!creation) {
      LOG.warn(`Nonce ${nonce} not found.`)
      return null
    }

    const hash = this.sha3(`${MemoryCRAuthManager.HASH_PREAMBLE} ${this.sha3(nonce)} ${this.sha3(origin)}`)
    const sigAddr = this.extractAddress(hash, signature)

    if (!sigAddr || sigAddr !== normalizedAddress) {
      LOG.warn(`Received invalid signature. Expected address: ${normalizedAddress}. Got address: ${sigAddr}.`)
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
    const hashBuf = new Buffer(hash.split('x')[1], 'hex')

    let pub

    try {
      const sig = util.fromRpcSig(signature)
      const prefix = new Buffer(MemoryCRAuthManager.ETH_PREAMBLE)
      const msg = new util.sha3(
        Buffer.concat([prefix, new Buffer(String(hashBuf.length)), hashBuf])
      )

      pub = util.ecrecover(msg, sig.v, sig.r, sig.s)
    } catch (e) {
      LOG.warn('Caught error trying to recover public key:', e)
      return null
    }

    return '0x' + util.publicToAddress(pub).toString('hex')
  }

  private sha3 (data: string): string {
    return this.web3.utils.sha3(data)
  }
}
