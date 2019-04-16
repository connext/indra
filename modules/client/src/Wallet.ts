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
  private password?: string

  constructor(opts: ConnextClientOptions) {
    this.password = opts.password

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
      const ethUrl = `${opts.hubUrl.substring(opts.hubUrl.length - 3)}/eth`
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
      this.signer = eth.Wallet.fromMnemonic(opts.mnemonic || '')

    // Second choice: Sign w mnemonic
    } else if (opts.mnemonic) {
      this.signer = eth.Wallet.fromMnemonic(opts.mnemonic || '')

    // Third choice: Sign w web3
    } else if (
      (opts.user && opts.web3 && opts.web3.eth) &&
      (opts.web3.eth.sign || (opts.web3.eth.personal && opts.web3.eth.personal.sign))
    ) {
      this.signer = (new eth.providers.Web3Provider((opts.web3.currentProvider as any))).getSigner();

    // Fallback: create new random mnemonic
    } else {
      this.signer = eth.Wallet.createRandom()
      console.log(`Created new wallet: ${this.signer.address}`)
    }

    this.signer.connect(this.provider)
    this.address = this.signer.address.toLowerCase()
  }

  // Methods
  getAddress = () => this.address
  signTransaction = (tx: any) => this.signer.sign(tx)
  sendTransaction = (tx: any) => this.signer.sendTransaction(tx)
  signMessage = (message: string) => this.signer.signMessage(message)

}

