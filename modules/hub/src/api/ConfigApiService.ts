import * as express from 'express'

import Config from '../Config'
import log from '../util/log'

import { ApiService } from './ApiService'

const LOG = log('ConfigApiService')

export default class ConfigApiService extends ApiService<ConfigApiServiceHandler> {
  public namespace: string = 'config'
  public routes: any = {
    'GET /': 'doGetConfig',
  }
  public handler: any = ConfigApiServiceHandler
  public dependencies: any = {
    'config': 'Config',
  }
}

class ConfigApiServiceHandler {
  public config: Config

  public doGetConfig(req: express.Request, res: express.Response): any {
    return res.send({
      contractAddress: this.config.channelManagerAddress,
      ethChainId: this.config.ethNetworkId,
      hubAddress: this.config.hotWalletAddress,
      maxCollateralization: this.config.beiMaxCollateralization.toString(),
      tokenAddress: this.config.tokenContractAddress,
    })
  }

}
