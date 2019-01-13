import * as fs from 'fs';
import { Utils } from 'connext/dist/Utils'
import { UnsignedChannelState, ChannelState } from 'connext/dist/types'
import * as eth from 'ethers';
import { Block } from 'web3/eth/types';
import Config from './Config'

export class SignerService {
  private web3: any

  private utils: Utils

  private config: Config

  constructor(web3: any, utils: Utils, config: Config) {
    this.web3 = web3
    this.utils = utils
    this.config = config
  }

  public async getLatestBlock(): Promise<Block> {
    return await this.web3.eth.getBlock('latest')
  }

  public async getSigForChannelState(
    state: UnsignedChannelState | ChannelState,
  ): Promise<string> {
    const stateHash = this.utils.createChannelStateHash(state)
    return await this.web3.eth.sign(stateHash, this.config.hotWalletAddress)
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
