import * as fs from 'fs'
import { Utils } from './vendor/connext/Utils'
import Config from './Config'
import { UnsignedChannelState, ChannelState, ChannelManagerChannelDetails } from './vendor/connext/types'
import { Block } from 'web3/types';
import { ChannelManager } from './ChannelManager';
import * as ethUtils from 'ethereumjs-util'

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

  // NOTE: not being used right now
  // (might be used later in OnchainTransactionService)
  public async signTransaction(tx: Object): Promise<string> {
    return await this.web3.eth.signTransaction(tx)
  }

  public async signMessage(message: string): Promise<string> {
    if (process.env.PRIVATE_KEY_FILE) {
      const pkString = fs.readFileSync(process.env.PRIVATE_KEY_FILE, 'utf8')
      const pk = ethUtils.toBuffer(ethUtils.addHexPrefix(pkString))
      const fingerprint = ethUtils.toBuffer(ethUtils.addHexPrefix(String(message)))
      const prefix = ethUtils.toBuffer('\x19Ethereum Signed Message:\n');
      const prefixedMsg = ethUtils.keccak256([
        prefix,
        ethUtils.toBuffer(String(fingerprint.length)),
        fingerprint
      ])
      const sig = await ethUtils.ecsign(ethUtils.toBuffer(prefixedMsg), pk)
      const out = '0x' + sig.r.toString('hex') + sig.s.toString('hex') + sig.v.toString(16)
      console.log(`Hub (${ethUtils.privateToAddress(pk).toString('hex')}) signed message="${message}" & produced sig ${out}`)
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
