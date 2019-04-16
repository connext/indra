import eth from 'ethers';
import Web3 from 'web3';
import { ConnextClientOptions } from './Connext';
import {
  Address,
} from './types';

// Conforms to the ethers signer API so we can use a web3 signer to create writable contracts
// More info: https://github.com/ethereum/web3.js/issues/2675

export interface IWallet {
  address: Address
  provider: any
  getAddress: () => Address
  signTransaction: (tx: any) => Promise<string>
  signMessage: (message: string) => Promise<string>
}

export default class Wallet implements IWallet {
  address: Address
  provider: any
  private password?: string
  private wallet?: any
  private web3?: any

  constructor(opts: ConnextClientOptions) {
    this.password = opts.password

    ////////////////////////////////////////
    // Setup our a signer

    // First choice: Sign w private key
    if (opts.privateKey) {
      this.wallet = eth.Wallet.fromMnemonic(opts.mnemonic || '')
      this.address = this.wallet.address.toLowerCase()

    // Second choice: Sign w mnemonic
    } else if (opts.mnemonic) {
      this.wallet = eth.Wallet.fromMnemonic(opts.mnemonic || '')
      this.address = this.wallet.address.toLowerCase()

    // Third choice: Sign w web3
    } else if (
      (opts.user && opts.web3 && opts.web3.eth) &&
      (opts.web3.eth.sign || (opts.web3.eth.personal && opts.web3.eth.personal.sign))
    ) {
      this.web3 = opts.web3
      this.address = opts.user.toLowerCase()

    // Fallback: create new random wallet
    } else {
      this.wallet = eth.Wallet.createRandom()
      this.address = this.wallet.address.toLowerCase()
    }

    ////////////////////////////////////////
    // Connect to an eth provider

    // First choice: use provided ethUrl
    if (opts.ethUrl) {
      this.provider = new eth.providers.JsonRpcProvider(opts.ethUrl)

    // Second choice: use provided web3
    } else if (opts.web3) {
      this.provider = new eth.providers.Web3Provider(opts.ethUrl)

    // Third choice: use hub's ethprovider (derived from hubUrl)
    } else if (opts.hubUrl.substring(opts.hubUrls.length - 4) === '/hub') {
      const ethUrl = `${opts.hubUrl.substring(opts.hubUrls.length - 3)}/eth`
      this.provider = new eth.providers.JsonRpcProvider(ethUrl)

    // Fallback: use ethers default provider (uses chainId=1 if ethNetworkId is null)
    } else {
      this.provider = eth.getDefaultProvider(ethers.providers.getNetwork(opts.ethNetworkId))
    }
  }

  getAddress() {
    return this.address
  }

  async signTransaction(tx: any) {
    if (this.wallet) {
      return await this.wallet.sign(tx)
    } else if (this.web3) {
      return await (
        this.web3.eth.personal
          ? this.web3.eth.personal.signTransaction(tx, this.address, this.password)
          : this.web3.eth.signTransaction(tx, this.address, this.password)
      )
    }
  }

  async signMessage(message: string) {
    if (this.wallet) {
      return await this.wallet.signMessage(message)
    } else if (this.web3) {
      return await (
        this.web3.eth.personal
          ? this.web3.eth.personal.sign(message, this.address, this.password)
          : this.web3.eth.sign(message, this.address, this.password)
      )
    }
  }
}

