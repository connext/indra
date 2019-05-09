import * as express from 'express'

import { ApiService } from './ApiService'

import Config from '../Config'
import log from '../util/log'

const LOG = log('ConfigApiService')

export default class ConfigApiService extends ApiService<ConfigApiServiceHandler> {
  namespace = 'config'
  routes = {
    'GET /': 'doGetConfig',
  }
  handler = ConfigApiServiceHandler
  dependencies = {
    'config': 'Config',
  }
}

class ConfigApiServiceHandler {
  config: Config

  doGetConfig(req: express.Request, res: express.Response) {
    const {
      channelManagerAddress,
      hotWalletAddress,
      tokenContractAddress,
      ethRpcUrl,
      ethNetworkId,
      beiMaxCollateralization,
    } = this.config
    return res.send({
      channelManagerAddress,
      hubWalletAddress: hotWalletAddress,
      tokenAddress: tokenContractAddress,
      ethRpcUrl,
      ethNetworkId,
      beiMaxCollateralization: beiMaxCollateralization.toString(),
    })
  }

}
