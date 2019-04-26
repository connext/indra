import { ethers as eth } from 'ethers';
import Web3 from 'web3';
import { ConnextClientOptions } from './Connext';
import { TransactionResponse } from './types';

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

    // Third choice: use hub's ethprovider (derived from hubUrl)
    } else if (opts.hubUrl.substring(opts.hubUrl.length - 4) === '/hub') {
      const ethUrl = `${opts.hubUrl.substring(0, opts.hubUrl.length - 4)}/eth`
      this.provider = new eth.providers.JsonRpcProvider(ethUrl)

    // Fallback: use default provider for this chain id
    } else if (opts.ethNetworkId)  {
      this.provider = eth.getDefaultProvider(eth.utils.getNetwork(parseInt(opts.ethNetworkId,10)))

    // If no chainid, default to rinkeby
    } else {
      this.provider = eth.getDefaultProvider('rinkeby')
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
    } else if (
      (opts.user && opts.web3 && opts.web3.eth) &&
      (opts.web3.eth.sign || (opts.web3.eth.personal && opts.web3.eth.personal.sign))
    ) {
      // this.signer = (new eth.providers.Web3Provider((opts.web3.currentProvider as any))).getSigner();
      this.web3 = opts.web3
      this.address = opts.user.toLowerCase()
      this.web3.eth.defaultAccount = this.address

    // Fallback: create new random mnemonic
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
      let sig, address

      // For web3 1.0.0-beta.33
      sig = await this.web3.eth.sign(eth.utils.hashMessage(bytes), this.address)
      address = eth.utils.verifyMessage(bytes, sig).toLowerCase()
      if (this.address === address) return sig
      console.warn(`web3.eth.sign(hashMessage("${message}")) -> sig=${sig} -> address=${address}`)

      // For web3 1.0.0-beta.52 in some cases
      sig = await this.web3.eth.personal.sign(eth.utils.hexlify(bytes), this.address, this.password)
      address = eth.utils.verifyMessage(bytes, sig).toLowerCase()
      if (this.address === address) return sig
      console.warn(`web3.eth.personal.sign("${message}") -> sig=${sig} -> address=${address}`)

      // For web3 1.0.0-beta.52 in other cases..?
      sig = await this.web3.eth.sign(eth.utils.hexlify(bytes), this.address)
      address = eth.utils.verifyMessage(bytes, sig).toLowerCase()
      if (this.address === address) return sig
      console.warn(`web3.eth.sign("${message}") -> sig=${sig} -> address=${address}`)

      throw new Error(`Couldn't find a web3 signing method that works...`)
    }
    throw new Error(`Could not sign message`)
  }

  async signTransaction(tx: any) {
    tx.to = await tx.to // Why is this sometimes a promise?!
    if (this.signer) {
      return await this.signer.sign(tx)
    }
    if (this.web3) {
      return await (this.web3.eth.signTransaction as any)(tx)
    }
  }

  // TODO: This is *supposed* to return a TransactionObject
  // but usually we end up parsing the event logs.
  // i *think* this is actually done by fetching the receipt
  // from the hash, so this should be okay
  async sendTransaction(tx: any): Promise<TransactionResponse> {
    const signedTx = await this.signTransaction(tx)
    const toSend = signedTx.raw ? signedTx.raw : signedTx
    if (this.provider) {
      return await this.provider.sendTransaction(toSend)
    } else if (this.web3) {
      // TODO: properly convert to transaction response type
      // const receipt = await this.web3.eth.sendSignedTransaction(toSend)
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
      return await this.web3.eth.sendSignedTransaction(toSend) as TransactionResponse
    }
    throw new Error("Could not send transaction")
  }

}

