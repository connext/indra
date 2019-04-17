import { ethers as eth } from 'ethers';
import Web3 from 'web3';
import { ConnextClientOptions } from './Connext';

export default class Wallet extends eth.Signer {
  address: string
  provider: any
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
      this.web3.eth.defaultAccount = this.address
      console.log(`Signing w web3 for user: ${this.address}`)

    // Fallback: create new random mnemonic
    } else {
      this.signer = eth.Wallet.createRandom()
      this.signer.connect(this.provider)
      this.address = this.signer.address.toLowerCase()
      console.log(`Created random new wallet: ${this.signer.address}`)
    }

  }

  async getAddress() {
    return this.address
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

  async signMessage(message: string) {
    if (this.signer) {
      return await this.signer.signMessage(message)
    }
    if (this.web3) {
      return await (
        this.web3.eth.sign
          ? this.web3.eth.sign(message, this.address)
          : this.web3.eth.personal.sign(message, this.address, this.password)
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

