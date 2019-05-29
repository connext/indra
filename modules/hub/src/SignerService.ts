import * as connext from 'connext'
import {
  ChannelManagerChannelDetails,
  ChannelState,
  Omit,
  UnsignedChannelState,
} from 'connext/types'
import * as eth from 'ethers'
import * as fs from 'fs'
import Web3 from 'web3'

import Config from './Config'
import { ChannelManager } from './contract/ChannelManager'
import { Block, RawTransaction, UnconfirmedTransaction } from './domain/OnchainTransaction'
import { rawTxnToTx } from './util/ethTransaction'

export class SignerService {
  constructor(
    private web3: Web3, 
    private contract: ChannelManager,
    private utils: connext.Utils, 
    private config: Config
  ) {
  }

  public async getChannelDetails(user: string): Promise<ChannelManagerChannelDetails> {
    const res = await this.contract.methods.getChannelDetails(user).call({ from: this.config.hotWalletAddress })
    return {
      txCountGlobal: +res[0],
      txCountChain: +res[1],
      threadRoot: res[2],
      threadCount: +res[3],
      exitInitiator: res[4],
      channelClosingTime: +res[5],
      status: res[6],
    }
  }

  public async getLatestBlock(): Promise<Block> {
    return await this.web3.eth.getBlock('latest')
  }

  public async signTransaction(txn: RawTransaction): Promise<UnconfirmedTransaction> {
    if (this.config.privateKeyFile) {
      const pkString = fs.readFileSync(this.config.privateKeyFile, 'utf8')
      const pk = Buffer.from(pkString, 'hex')

      const tx = rawTxnToTx(txn)
      tx.sign(pk)
      return {
        ...txn,
        hash: '0x' + tx.hash(true).toString('hex'),
        signature: {
          r: '0x' + tx.r.toString('hex'),
          s: '0x' + tx.s.toString('hex'),
          v: this.web3.utils.hexToNumber('0x' + tx.v.toString('hex')),
        },
      }
    } else {
      const signed = await this.web3.eth.signTransaction(txn)
      return {
        ...txn,
        hash: signed.tx.hash,
        signature: {
          r: signed.tx.r,
          s: signed.tx.s,
          v: this.web3.utils.hexToNumber(signed.tx.v),
        }
      }
    }
  }

  public async signMessage(message: string): Promise<string> {
    const bytes = eth.utils.isHexString(message)
      ? eth.utils.arrayify(message)
      : eth.utils.toUtf8Bytes(message)

    if (this.config.privateKeyFile) {
      const wallet = new eth.Wallet(fs.readFileSync(this.config.privateKeyFile, 'utf8'))
      return await wallet.signMessage(bytes)
    } else {
      let sig

      // Modern versions of web3 will add the standard ethereum message prefix for us
      sig = await this.web3.eth.sign(eth.utils.hexlify(bytes), this.config.hotWalletAddress)
      if (this.config.hotWalletAddress === eth.utils.verifyMessage(bytes, sig).toLowerCase()) {
        return sig
      }

      // Old versions of web3 did not, we'll add it ourself
      sig = await this.web3.eth.sign(eth.utils.hashMessage(bytes), this.config.hotWalletAddress)
      if (this.config.hotWalletAddress === eth.utils.verifyMessage(bytes, sig).toLowerCase()) {
        return sig
      }
    }
  }

  public async getSigForChannelState(
    state: UnsignedChannelState | ChannelState,
  ): Promise<string> {
    const stateHash = this.utils.createChannelStateHash(state)
    return await this.signMessage(stateHash)
  }

  public async signChannelState(
    state: UnsignedChannelState | ChannelState,
    sigUser: string = null,
  ): Promise<ChannelState> {
    const sigHub = await this.getSigForChannelState(state)
    return {
      ...state,
      sigHub,
      sigUser,
    }
  }
}
