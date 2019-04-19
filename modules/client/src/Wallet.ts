import { ethers as eth } from 'ethers';
import Web3 from 'web3';
import { ConnextClientOptions } from './Connext';
import { Provider } from './types'

export default class Wallet extends eth.Signer {
  address: string
  provider: any // Provider
  signer: any
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
      this.signer = eth.Wallet.fromMnemonic(opts.mnemonic || '')
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
    }

  }

  async getAddress() {
    return this.address
  }

  async signMessage(message: string) {
    if (this.signer) {
      return await this.signer.signMessage(eth.utils.arrayify(message))
    }
    if (this.web3) {
      return await (
        this.web3.eth.sign
          ? this.web3.eth.sign(message, this.address)
          : this.web3.eth.personal.sign(message, this.address, this.password)
      )
    }
  }

  async signTransaction(tx: any) {
    tx.to = await tx.to // Why is this sometimes a promise?!
    if (this.signer) {
      return await this.signer.sign(tx)
    }
    if (this.web3) {
      return await (
        this.web3.eth.signTransaction
          ? (this.web3.eth.signTransaction as any)(tx)
          : this.web3.eth.personal.signTransaction(tx, this.password)
      )
    }
  }

  async sendTransaction(tx: any) {
    const signedTx = await this.signTransaction(tx)
    const toSend = signedTx.raw ? signedTx.raw : signedTx
    if (this.provider) {
      return await this.provider.sendTransaction(toSend)
    }
    if (this.web3) {
      return await this.web3.eth.sendSignedTransaction(toSend)
    }
  }

}

