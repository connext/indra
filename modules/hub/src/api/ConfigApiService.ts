import { ApiService, } from './ApiService'
import * as express from 'express'
import CRAuthManager from '../CRAuthManager'
import log from '../util/log'
import Config from '../Config'
import { Address } from '../vendor/connext/types';

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

type ConfigAddresses = {
  channelManager: Address,
  tokenContract: Address,
  hubWallet: Address,
  rpcUrl: string,
}

type NetworksAvailable = {
  'local': 'local',
  'mainnet': 'mainnet',
  'rinkeby': 'rinkeby',
}
type NetworkAvailable = keyof NetworksAvailable

class ConfigApiServiceHandler {
  config: Config

  doGetConfig(req: express.Request, res: express.Response) {
    const {
      channelManagerAddress,
      hotWalletAddress,
      tokenContractAddress,
      ethRpcUrl,
      beiMaxCollateralization,
    } = this.config
    return res.send({
      channelManagerAddress,
      hotWalletAddress,
      tokenContractAddress,
      ethRpcUrl,
      beiMaxCollateralization,
    })
  }

}
