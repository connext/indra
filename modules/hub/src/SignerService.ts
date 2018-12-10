import { Utils } from './vendor/connext/Utils'
import Config from './Config'
import { UnsignedChannelState, ChannelState } from './vendor/connext/types'
import fs from 'fs'
const ethers = require('ethers');

export class SignerService {
  private web3: any

  private utils: Utils

  private config: Config

  constructor(web3: any, utils: Utils, config: Config) {
    this.web3 = web3
    this.utils = utils
    this.config = config
  }

  public async getSigForChannelState(
    state: UnsignedChannelState | ChannelState,
  ): Promise<string> {
    const stateHash = this.utils.createChannelStateHash(state)
    let wallet = new ethers.Wallet(fs.readFileSync('/run/secret/private_key'))
    let binaryData = ethers.utils.arrayify(stateHash);
    return await wallet.signMessage(binaryData)

    //return await this.web3.eth.sign(stateHash, this.config.hotWalletAddress)
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
