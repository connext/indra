import * as eth from 'ethers'
import Web3 from 'web3'

import { IConnextChannelOptions } from './Connext'
import {
  objMapPromise,
  TransactionRequest,
  TransactionResponse,
} from './types'

const {
  arrayify, bigNumberify, hashMessage, hexlify, isHexString, toUtf8Bytes, verifyMessage,
} = eth.utils

export class Wallet extends eth.Signer {
  public address: string
  public provider: eth.providers.BaseProvider
  private signer?: eth.Wallet
  private web3?: Web3
  private password: string

  public constructor(opts: IConnextChannelOptions) {
    super()
    this.password = opts.password || ''

    ////////////////////////////////////////
    // Connect to an eth provider

    // First choice: use provided ethUrl
    if (opts.ethUrl) {
      this.provider = new eth.providers.JsonRpcProvider(opts.ethUrl)

    // Second choice: use provided web3
    } else if (opts.web3Provider) {
      this.provider = new eth.providers.Web3Provider(opts.web3Provider)

    // Default: use hub's ethprovider (derived from hubUrl)
    } else {
      const ethUrl: string = `${opts.hubUrl.substring(0, opts.hubUrl.length - '/hub'.length)}/eth`
      this.provider = new eth.providers.JsonRpcProvider(ethUrl)
    }

    ////////////////////////////////////////
    // Setup our a signer

    // First choice: Sign w private key
    if (opts.privateKey) {
      this.signer = new eth.Wallet(opts.privateKey || '')
      this.signer = this.signer.connect(this.provider)
      this.address = this.signer.address.toLowerCase()

    // Second choice: Sign w mnemonic
    } else if (opts.mnemonic) {
      this.signer = eth.Wallet.fromMnemonic(opts.mnemonic || '')
      this.signer = this.signer.connect(this.provider)
      this.address = this.signer.address.toLowerCase()

    // Third choice: Sign w web3
    } else if (opts.user && opts.web3Provider) {
      this.web3 = new Web3(opts.web3Provider as any)
      this.address = opts.user.toLowerCase()
      this.web3.eth.defaultAccount = this.address

    // Default: abort, we need to be given a signer
    } else {
      throw new Error(`Wallet needs to be given a signing method`)
    }
  }

  public async getAddress(): Promise<string> {
    return this.address
  }

  public async signMessage(message: string): Promise<string> {
    const bytes: Uint8Array = isHexString(message) ? arrayify(message) : toUtf8Bytes(message)

    if (this.signer) {
      return this.signer.signMessage(bytes)
    }
    if (this.web3) {
      let sig: string

      // Modern versions of web3 will add the standard ethereum message prefix for us
      sig = await this.web3.eth.sign(hexlify(bytes), this.address)
      if (this.address === verifyMessage(bytes, sig).toLowerCase()) {
        return sig
      }

      // Old versions of web3 did not, we'll add it ourself
      sig = await this.web3.eth.sign(hashMessage(bytes), this.address)
      if (this.address === verifyMessage(bytes, sig).toLowerCase()) {
        return sig
      }

      // Weird version of web3 that does something else? idk then
      throw new Error(`Couldn't find a web3 signing method that works...`)
    }
    throw new Error(`Could not sign message`)
  }

  public async signTransaction(tx: TransactionRequest): Promise<string> {
    if (this.signer) {
      return this.signer.sign(tx)
    }
    if (this.web3) {
      // resolve any promise fields
      const resolve: any = async (k: string, v: any): Promise<any> => v
      const resolved: any = await objMapPromise(tx, resolve) as any
      // convert to right object
      const txObj: any = {
        data: resolved.data,
        from: this.address,
        gas: parseInt(resolved.gasLimit, 10),
        gasPrice: resolved.gasPrice,
        to: resolved.to,
        value: resolved.value,
      }
      return (await this.web3.eth.signTransaction(txObj)).raw // TODO: fix type
    }
    throw new Error(`Could not sign transaction`)
  }

  public async sendTransaction(txReq: TransactionRequest): Promise<TransactionResponse> {
    txReq.gasPrice = await (txReq.gasPrice || this.provider.getGasPrice())
    // Sanity check: Do we have sufficient funds for this tx?
    const balance = bigNumberify(await this.provider.getBalance(this.address))
    const gasLimit = bigNumberify(await txReq.gasLimit || '21000')
    const gasPrice = bigNumberify(await txReq.gasPrice)
    const value = bigNumberify(await (txReq.value || '0'))
    const total = value.add(gasLimit.mul(gasPrice))
    if (balance.lt(total)) {
      throw new Error(
        `Insufficient funds: value=${value} + (gasPrice=${gasPrice
        } * gasLimit=${gasLimit}) = total=${total} > balance=${balance}`,
      )
    }
    if (!txReq.nonce && this.signer) {
      txReq.nonce = this.signer.getTransactionCount('pending')
    }
    const signedTx: string = await this.signTransaction(txReq)
    return this.provider.sendTransaction(signedTx)
  }

}
