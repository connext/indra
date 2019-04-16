import { ethers as eth } from 'ethers';
import Web3 from 'web3';
import { ConnextClientOptions } from './Connext';
import { Address, } from './types';

export interface IWallet {
  address: Address
  provider: any
  signer: any
  signTransaction: (tx: any) => Promise<string>
  sendTransaction: (tx: any) => Promise<any>
  signMessage: (message: string) => Promise<string>
  getAddress: () => Address // Needed to conform to ethers signer API
}

export default class Wallet implements IWallet {
  address: Address
  provider: any
  signer: any
  web3?: Web3
  private password: string

  constructor(opts: ConnextClientOptions) {
    this.password = opts.password || ''

    ////////////////////////////////////////
    // Connect to an eth provider

    // First choice: use provided ethUrl
    if (opts.ethUrl) {
      this.provider = new eth.providers.JsonRpcProvider(opts.ethUrl)
      console.log(`Using ethUrl: ${opts.ethUrl}`)

    // Second choice: use provided web3
    } else if (opts.web3 && opts.web3.currentProvider) {
      this.provider = new eth.providers.Web3Provider((opts.web3.currentProvider as any))
      console.log(`Using web3 provider [${typeof this.provider}]`)

    // Third choice: use hub's ethprovider (derived from hubUrl)
    } else if (opts.hubUrl.substring(opts.hubUrl.length - 4) === '/hub') {
      const ethUrl = `${opts.hubUrl.substring(opts.hubUrl.length - 3)}/eth`
      this.provider = new eth.providers.JsonRpcProvider(ethUrl)
      console.log(`Using hub's provider: ${ethUrl}`)

    // Fallback: use default provider for this chain id
    } else if (opts.ethNetworkId)  {
      this.provider = eth.getDefaultProvider(eth.utils.getNetwork(parseInt(opts.ethNetworkId,10)))
      console.log(`Using default provider for network: ${opts.ethNetworkId}`)

    // If no chainid, default to rinkeby
    } else {
      this.provider = eth.getDefaultProvider('rinkeby')
      console.log(`Using default provider for network: 4`)
    }

    ////////////////////////////////////////
    // Setup our a signer

    // First choice: Sign w private key
    if (opts.privateKey) {
      this.signer = eth.Wallet.fromMnemonic(opts.mnemonic || '')
      this.signer.connect(this.provider)
      this.address = this.signer.address.toLowerCase()
      console.log(`Signing w private key ${opts.privateKey.substring(0,0)}... ${this.signer.address}`)

    // Second choice: Sign w mnemonic
    } else if (opts.mnemonic) {
      this.signer = eth.Wallet.fromMnemonic(opts.mnemonic || '')
      this.signer.connect(this.provider)
      this.address = this.signer.address.toLowerCase()
      console.log(`Signing w mnemonic ${opts.mnemonic.substring(0,0)}... ${this.signer.address}`)

    // Third choice: Sign w web3
    } else if (
      (opts.user && opts.web3 && opts.web3.eth) &&
      (opts.web3.eth.sign || (opts.web3.eth.personal && opts.web3.eth.personal.sign))
    ) {
      // this.signer = (new eth.providers.Web3Provider((opts.web3.currentProvider as any))).getSigner();
      this.web3 = opts.web3
      this.address = opts.user.toLowerCase()
      console.log(`Signing w web3 ${typeof this.signer}... ${this.address}`)

    // Fallback: create new random mnemonic
    } else {
      this.signer = eth.Wallet.createRandom()
      this.signer.connect(this.provider)
      this.address = this.signer.address.toLowerCase()
      console.log(`Created random new wallet: ${this.signer.address}`)
    }

  }

  // Methods

  getAddress = () => this.address

  async signTransaction(tx: any) {
    if (this.signer) {
      return await this.signer.sign(tx)
    } else if (this.web3) {
      return await (
        this.web3.eth.personal
          ? this.web3.eth.personal.signTransaction(tx, this.address)
          : this.web3.eth.signTransaction(tx, this.address)
      )
    }
  }

  async signMessage(message: string) {
    console.log(`signMessage activated`)
    if (this.signer) {
      return await this.signer.signMessage(message)
    } else if (this.web3) {
      return await (
        this.web3.eth.personal
          ? this.web3.eth.personal.sign(message, this.address, this.password)
          : this.web3.eth.sign(message, this.address, console.log)
      )
    }
  }


  async sendTransaction(tx: any) {
    if (this.signer) { return await this.signer.signTransaction(tx) }
    else
    if (this.web3) { return await this.web3.eth.sendTransaction(tx) }
  }

}

