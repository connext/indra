import { ethers as eth } from 'ethers';
import Web3 from 'web3';
import { ConnextClientOptions } from './Connext';
import {
  Transaction,
  UnsignedTransaction,
  TransactionRequest,
  TransactionResponse,
} from './types';

export default class Wallet extends eth.Signer {
  address: string
  provider: eth.providers.BaseProvider
  signer?: eth.Wallet
  web3?: Web3
  private password: string

  constructor(opts: ConnextClientOptions) {
    super()
    this.password = opts.password || ''

    ////////////////////////////////////////
    // Connect to an eth provider

    // First choice: use provided ethUrl
    if (opts.ethUrl) {
      this.provider = new eth.providers.JsonRpcProvider(opts.ethUrl)

    // Second choice: use provided web3
    } else if (opts.web3 && opts.web3.currentProvider) {
      this.provider = new eth.providers.Web3Provider((opts.web3.currentProvider as any))

    // Default: use hub's ethprovider (derived from hubUrl)
    } else {
      const ethUrl = `${opts.hubUrl.substring(0, opts.hubUrl.length - 4)}/eth`
      this.provider = new eth.providers.JsonRpcProvider(ethUrl)
    }

    ////////////////////////////////////////
    // Setup our a signer

    // First choice: Sign w private key
    if (opts.privateKey) {
      this.signer = new eth.Wallet(opts.privateKey || '')
      this.signer.connect(this.provider)
      this.address = this.signer.address.toLowerCase()

    // Second choice: Sign w mnemonic
    } else if (opts.mnemonic) {
      this.signer = eth.Wallet.fromMnemonic(opts.mnemonic || '')
      this.signer.connect(this.provider)
      this.address = this.signer.address.toLowerCase()

    // Third choice: Sign w web3
    } else if (opts.user && opts.web3 && opts.web3.eth && opts.web3.eth.sign) {
      this.web3 = opts.web3
      this.address = opts.user.toLowerCase()
      this.web3.eth.defaultAccount = this.address

    // Default: create new random mnemonic
    } else {
      this.signer = eth.Wallet.createRandom()
      this.signer.connect(this.provider)
      this.address = this.signer.address.toLowerCase()
      console.warn(`Generated a new signing key, make sure you back it up before sending funds`)
    }
  }

  async getAddress() {
    return this.address
  }

  async signMessage(message: string) {
    const bytes = eth.utils.isHexString(message)
      ? eth.utils.arrayify(message)
      : eth.utils.toUtf8Bytes(message)

    if (this.signer) {
      return await this.signer.signMessage(bytes)
    }
    if (this.web3) {
      let sig

      // Modern versions of web3 will add the standard ethereum message prefix for us
      sig = await this.web3.eth.sign(eth.utils.hexlify(bytes), this.address)
      if (this.address === eth.utils.verifyMessage(bytes, sig).toLowerCase()) {
        return sig
      }

      // Old versions of web3 did not, we'll add it ourself
      sig = await this.web3.eth.sign(eth.utils.hashMessage(bytes), this.address)
      if (this.address === eth.utils.verifyMessage(bytes, sig).toLowerCase()) {
        return sig
      }

      // Weird version of web3 that does something else? idk then
      throw new Error(`Couldn't find a web3 signing method that works...`)
    }
    throw new Error(`Could not sign message`)
  }

  async signTransaction(tx: TransactionRequest): Promise<string> {
    if (this.signer) {
      return await this.signer.sign(tx)
    }
    if (this.web3) {
      return (await (this.web3.eth.signTransaction as any)(tx)).raw // TODO: fix type
    }
    throw new Error(`Could not sign transaction`)
  }

  // TODO: This could return a TransactionResponse or whatever
  // Not a huge deal right now, we only ever use the `.hash` property of the return value
  async sendTransaction(tx: TransactionRequest): Promise<TransactionResponse> {
    // TransactionRequest properties can be promises, make sure they've all resolved
    tx.to = await tx.to // TODO: replace this line w below
    //for (let prop in tx) {
    //  tx[prop] = tx[prop] && typeof tx[prop] === 'object' ? await tx[prop] : tx[prop]
    //}

    const signedTx = await this.signTransaction(tx)
    if (this.provider) {
      return await this.provider.sendTransaction(signedTx)
    } else if (this.web3) {
      // TODO: properly convert to transaction response type
      // const receipt = await this.web3.eth.sendSignedTransaction(signedTx)
      // return {
      //   blockHash: receipt.blockHash,
      //   blockNumber: receipt.blockNumber,//3346463,
      //   timestamp: 0, // best way to get?
      //   creates: null,
      //   to: receipt.to,
      //   data: , // ??
      //   from: receipt.from,
      //   hash: receipt.transactionHash,
      //   gasLimit:  , // ?? BigNumberify
      //   gasPrice: , // ?? BigNumberify
      //   nonce: , // ?? number
      //   value: , // ?? string
      //   r: , // ?? string
      //   s: , // ?? string
      //   v: , // ?? string
      //   raw: , // ?? string
      // }
      // @ts-ignore
      return await this.web3.eth.sendSignedTransaction(signedTx) as TransactionResponse
    }
    throw new Error("Could not send transaction")
  }

}

