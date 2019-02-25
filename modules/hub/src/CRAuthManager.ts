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

    if (!creation) {
      LOG.warn(`Nonce ${nonce} not found.`)
      return null
    }

    const hash = this.sha3(`${MemoryCRAuthManager.HASH_PREAMBLE}${this.sha3(nonce)}${this.sha3(origin)}`)
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
    const hashBuf = new Buffer(hash.split('x')[1], 'hex')
    console.log("Hash sent to extract", hash)
    let pub

    try {
      const sig = util.fromRpcSig(signature)
      const prefix = new Buffer(MemoryCRAuthManager.ETH_PREAMBLE)
      const authHash = Buffer.concat([prefix, new Buffer(String(hashBuf.length)), hashBuf])
      const authHashHex = authHash.toString('hex')

      const msg = new util.sha3(
        authHashHex
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
// {"depositWei":"100000","depositToken":"0","sigUser":"0xd05d4d88bd90dd17ad2e2373871009f8012ce4a31d49f90973ff7af020ac088f069fc4c06018e9bd4c8d815290bb066919f36783070539ff3595c8228945a0741b","lastChanTx":6,"lastThreadUpdateId":0}
