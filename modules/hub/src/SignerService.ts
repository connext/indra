import * as fs from 'fs'
import { Utils } from './vendor/connext/Utils'
import Config from './Config'
import { UnsignedChannelState, ChannelState, ChannelManagerChannelDetails, Omit } from './vendor/connext/types'
import { Block } from 'web3/types';
import { ChannelManager } from './ChannelManager';
import * as ethUtils from 'ethereumjs-util'
import EthereumTx from "ethereumjs-tx"
import log from './util/log'
import { RawTransaction, UnconfirmedTransaction } from './domain/OnchainTransaction';
import { rawTxnToTx } from './util/ethTransaction';

const LOG = log('SignerService')

export class SignerService {
  constructor(
    private web3: any, 
    private contract: ChannelManager,
    private utils: Utils, 
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
    if (this.config.privateKeyFile) {
      const pkString = fs.readFileSync(this.config.privateKeyFile, 'utf8')
      const pk = ethUtils.toBuffer(ethUtils.addHexPrefix(pkString))
      const fingerprint = ethUtils.toBuffer(String(message))
      const prefix = ethUtils.toBuffer('\x19Ethereum Signed Message:\n');
      const prefixedMsg = ethUtils.keccak256(Buffer.concat([
        prefix,
        ethUtils.toBuffer(String(fingerprint.length)),
        fingerprint
      ]))
      const sig = await ethUtils.ecsign(ethUtils.toBuffer(prefixedMsg), pk)
      const out = '0x' + sig.r.toString('hex') + sig.s.toString('hex') + sig.v.toString(16)
      LOG.info(`Hub (${ethUtils.privateToAddress(pk).toString('hex')}) signed a message:`)
      LOG.info(`message="${message}" (prefixed="${ethUtils.bufferToHex(prefixedMsg)}")`)
      LOG.info(`sig=${out}`)
      return out
    } else {
      return await this.web3.eth.sign(message, this.config.hotWalletAddress)
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
