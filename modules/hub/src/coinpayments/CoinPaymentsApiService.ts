import { CoinPaymentsService } from './CoinPaymentsService'
import { default as log } from '../util/log'
import { ApiService } from '../api/ApiService'
import { default as Config } from '../Config'
import { Request, Response } from 'express'
import { CoinPaymentsApiClient } from './CoinPaymentsApiClient'
import { getUserFromRequest } from '../util/request'
import { CoinPaymentsDepositAddress } from './CoinPaymentsDao'

const LOG = log('CoinPaymentsApiService')

export class CoinPaymentsApiService extends ApiService<
  CoinPaymentsApiServiceHandler
  > {
  namespace = 'coinpayments'
  routes = {
    'GET /debug/status': 'doDebugStatus',
    'POST /ipn/:user': 'doHandleIpn',
    'GET /address/:user/:currency': 'doGetAddress',
  }
  handler = CoinPaymentsApiServiceHandler
  dependencies = {
    client: 'CoinPaymentsApiClient',
    service: 'CoinPaymentsService',
    config: 'Config',
  }
}

export class CoinPaymentsApiServiceHandler {
  client: CoinPaymentsApiClient
  service: CoinPaymentsService
  config: Config

  async doDebugStatus(req: Request, res: Response) {
    const info = await this.client.getBasicInfo()
    return res.json({
      merchantId: info.merchant_id,
      callback: await this.client.getCallbackAddress(this.config.hotWalletAddress, 'ETH'),
      coins: await this.client.getCoinsAndRates(),
    })
  }

  async doHandleIpn(req: Request, res: Response) {
    const sig = req.header('HMAC')
    if (!sig)
      throw new Error('Did not get expected HMAC header: ' + JSON.stringify(req.headers) + '; body: ' + (await req.getText()))

    if (!req.params.user)
      throw new Error('Invalid user: ' + JSON.stringify(req.params.user))

    const ipn = this.service.parseIpnData(sig, await req.getText())
    await this.service.handleCoinPaymentsIpn(req.params.user, ipn)

    res.send('IPN OK')
  }

  async doGetAddress(req: Request, res: Response) {
    const user = getUserFromRequest(req)
    const addr = await this.service.getUserDepositAddress(user, req.params.currency)
    const depositAddress: CoinPaymentsDepositAddress = {
      address: addr.address,
      destTag: addr.destTag,
    }
    res.json(depositAddress)
  }

}
