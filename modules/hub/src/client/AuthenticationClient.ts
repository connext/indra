import pify from '../util/pify'

const util = require('ethereumjs-util')

export interface AuthenticationResult {
  address: string,
  token: string
}

export class AuthenticationClient {
  private hubUrl: string

  private web3: any

  private fetch: any

  constructor(hubUrl: string, web3: any, injectedFetch: any) {
    this.hubUrl = hubUrl
    this.web3 = web3
    this.fetch = injectedFetch
  }

  public async authenticate(address: string, origin: string): Promise<AuthenticationResult> {
    const challengeRes = await this.fetch(this.url('challenge'), {
      method: 'POST',
      credentials: 'include',
    })
    const challengeJson = await challengeRes.json()
    const nonce = challengeJson.nonce
    const hash = this.genHash(nonce, origin)
    const signature = await pify<string>((cb) => this.web3.eth.sign(address, hash, cb))

    if (!signature) {
      throw new Error('Failed to sign message.')
    }

    const authRes = await this.fetch(this.url('response'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        signature,
        nonce,
        origin,
        address,
      }),
    })
    const authJson = await authRes.json()

    return {
      address,
      token: authJson.token,
    }
  }

  private url(path: string): string {
    return `${this.hubUrl}/auth/${path}`
  }

  private genHash(nonce: string, origin: string) {
    let msg = `SpankWallet authentication message: ${this.web3.sha3(nonce)} ${this.web3.sha3(origin)}`

    if (this.web3.currentProvider.isMetaMask) {
      msg = this.web3.sha3(msg)

      // need to use buffers below in order to operate on raw bytes
      const hashBuf = new Buffer(msg.split('x')[1], 'hex')
      const prefix = new Buffer('\x19Ethereum Signed Message:\n')
      const buf = Buffer.concat([
        prefix,
        new Buffer(String(hashBuf.length)),
        hashBuf,
      ])

      return `0x${util.sha3(buf.toString('hex'))}`
    }

    return this.web3.sha3(msg)
  }
}
