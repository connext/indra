import { ethers as eth } from 'ethers'
import * as uuid from 'uuid'

import log from './util/log'

const { arrayify, isHexString, toUtf8Bytes, verifyMessage } = eth.utils
const LOG = log('AuthManager')
const CHALLENGE_EXPIRY_MS = 1000 * 60 * 2 // 2 hours

export default interface CRAuthManager {
  generateNonce(): Promise<string>
  checkSignature(
    address: string, nonce: string, domain: string, signature: string,
  ): Promise<string | undefined>
}

export class MemoryCRAuthManager implements CRAuthManager {
  private nonces: { [s: string]: number } = {}

  public generateNonce (): Promise<string> {
    const nonce = uuid.v4()
    this.nonces[nonce] = Date.now()
    return Promise.resolve(nonce)
  }

  public async checkSignature (
    address: string, nonce: string, origin: string, signature: string,
  ): Promise<string | undefined> {
    const creation = this.nonces[nonce]

    if (!eth.utils.isHexString(signature)) {
      LOG.error(`Signature must be a valid hex string: ${signature}`)
      return undefined
    }

    if (!creation) {
      LOG.warn(`Nonce "${nonce}" not found.`)
      return undefined
    }

    const bytes = isHexString(nonce) ? arrayify(nonce) : toUtf8Bytes(nonce)
    const sigAddr: string = eth.utils.verifyMessage(bytes, signature).toLowerCase()

    if (!sigAddr || sigAddr !== address) {
      LOG.warn(`Signature doesn't match. Expected: ${address}, Got: ${sigAddr}`)
      return undefined

    }

    if (Date.now() - creation > CHALLENGE_EXPIRY_MS) {
      LOG.warn(`Nonce for address ${sigAddr} is expired.`)
      return undefined
    }

    delete this.nonces[nonce]

    return sigAddr
  }

}
