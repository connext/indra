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
  private external?: boolean

  public constructor(opts: IConnextChannelOptions) {
    super()

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
    // Third choice: External wallets
    } else if (opts.externalWallet) {
      this.signer = opts.externalWallet
      this.external = true
      this.address = opts.externalWallet.address.toLowerCase()
    // Fourth choice: Sign w web3
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

  private async prepareTransaction(tx: TransactionRequest): Promise<any> {

      tx.gasPrice = await (tx.gasPrice || this.provider.getGasPrice())
      // Sanity check: Do we have sufficient funds for this tx?
      const balance = bigNumberify(await this.provider.getBalance(this.address))
      const gasLimit = bigNumberify(await tx.gasLimit || '21000')
      const gasPrice = bigNumberify(await tx.gasPrice)
      const value = bigNumberify(await (tx.value || '0'))
      const total = value.add(gasLimit.mul(gasPrice))
      if (balance.lt(total)) {
        throw new Error(
          `Insufficient funds: value=${value} + (gasPrice=${gasPrice
          } * gasLimit=${gasLimit}) = total=${total} > balance=${balance}`,
        )
      }

      // External wallets should have their own nonce calculation
      if (!tx.nonce && this.signer && !this.external) {
        tx.nonce = this.signer.getTransactionCount('pending')
      }
       // resolve any promise fields
      const resolve: any = async (k: string, v: any): Promise<any> => v
      const resolved: any = await objMapPromise(tx, resolve) as any
      // convert to right object
      return {
        data: resolved.data,
        from: this.address,
        gas: parseInt(resolved.gasLimit, 10),
        gasPrice: resolved.gasPrice,
        to: resolved.to,
        value: resolved.value,
      }
  }

  public async signTransaction(tx: TransactionRequest): Promise<string> {
    if (this.signer) {
      return this.signer.sign(tx)
    }
    if (this.web3) {
      const txObj:any = await this.prepareTransaction(tx)
      return (await this.web3.eth.signTransaction(txObj)).raw // TODO: fix type
    }
    throw new Error(`Could not sign transaction`)
  }

  private async signAndSendTransactionExternally(tx: TransactionRequest): Promise<any> {
    if (this.signer) {
      const txObj:any = await this.prepareTransaction(tx)
      return this.signer.sign(txObj)
    }
    throw new Error(`Could not sign transaction`)
  }

  public async sendTransaction(txReq: TransactionRequest): Promise<TransactionResponse> {
    if (this.external){
      return this.signAndSendTransactionExternally(txReq)
    }
    if (this.signer){
      return this.signer.sendTransaction(txReq)
    }
    const signedTx: string = await this.signTransaction(txReq)
    return this.provider.sendTransaction(signedTx)
  }

}
