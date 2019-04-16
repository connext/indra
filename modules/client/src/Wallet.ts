import eth from 'ethers';
import Web3 from 'web3';
import { ConnextClientOptions } from './Connext';
import {
  Address,
} from './types';

export interface IWallet {
  address: Address
  signTransaction: (tx: any) => Promise<string>
  signMessage: (message: string) => Promise<string>
}

export default class Wallet implements IWallet {
  address: string
  private password?: string
  private wallet?: any
  private web3?: any

  constructor(opts: ConnextClientOptions) {
    this.password = opts.password

    // First choice: Sign w private key
    if (opts.privateKey) {
      this.wallet = eth.Wallet.fromMnemonic(opts.mnemonic || '')
      this.address = this.wallet.address

    // Second choice: Sign w mnemonic
    } else if (opts.mnemonic) {
      this.wallet = eth.Wallet.fromMnemonic(opts.mnemonic || '')
      this.address = this.wallet.address

    // Third choice: Sign w web3
    } else if (
      (opts.user && opts.web3 && opts.web3.eth) &&
      (opts.web3.eth.sign || (opts.web3.eth.personal && opts.web3.eth.personal.sign))
    ) {
      this.web3 = opts.web3
      this.address = opts.user

    // Fallback: create new random wallet
    } else {
      this.wallet = eth.Wallet.createRandom()
      this.address = this.wallet.address
    }
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

