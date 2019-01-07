import { Utils } from 'connext/dist/Utils'
import Config from './Config'
import { UnsignedChannelState, ChannelState } from 'connext/dist/types'
import * as fs from 'fs';
import * as eth from 'ethers';

export class SignerService {
  private web3: any

  private wallet: any

  private utils: Utils

  private config: Config

  constructor(web3: any, utils: Utils, config: Config) {
    this.web3 = web3
    this.utils = utils
    this.config = config
    this.wallet = new eth.Wallet(fs.readFileSync(process.env.PRIVATE_KEY_FILE, 'utf8'))
  }

  public async sign(hash: string): Promise<string> {
    return await this.wallet.signMessage(eth.utils.arrayify(hash))
  }

  public async getSigForChannelState(
    state: UnsignedChannelState | ChannelState,
  ): Promise<string> {
    const stateHash = this.utils.createChannelStateHash(state)
    return await this.wallet.signMessage(eth.utils.arrayify(stateHash))
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
