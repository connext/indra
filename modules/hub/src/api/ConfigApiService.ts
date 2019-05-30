import * as express from 'express'

import Config from '../Config'

import { ApiService } from './ApiService'
import { isServiceOrAdmin } from '../util/ownedAddressOrAdmin';
import { isBN } from '../util';

export default class ConfigApiService extends ApiService<ConfigApiServiceHandler> {
  public namespace: string = 'config'
  public routes: any = {
    'GET /': 'doGetConfig',
    'GET /admin': 'doGetAdminConfig'
  }
  public handler: any = ConfigApiServiceHandler
  public dependencies: any = {
    'config': 'Config',
  }
}

class ConfigApiServiceHandler {
  public config: Config

  // unauthed endpoint
  public doGetConfig(req: express.Request, res: express.Response): any {
    return res.send({
      contractAddress: this.config.channelManagerAddress,
      ethChainId: this.config.ethNetworkId,
      hubAddress: this.config.hotWalletAddress,
      maxCollateralization: this.config.beiMaxCollateralization.toString(),
      tokenAddress: this.config.tokenContractAddress,
    })
  }

  // admin only config
  public doGetAdminConfig(req: express.Request, res: express.Response): any {
    if (!isServiceOrAdmin(req)) {
      res.status(403)
      return res.send({ error: 'Admin role not detected on request.' })
    }
    // cast bn values to string
    let response = {}
    for (let key in this.config) {
      if (isBN(this.config[key])) {
        response[key] = this.config[key].toString()
      } else {
        response[key] = this.config[key]
      }
    }
    return res.send(response)
  }

}
