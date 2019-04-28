import { ApiService, } from './ApiService'
import * as express from 'express'
import log from '../util/log'
import Config from '../Config'

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
