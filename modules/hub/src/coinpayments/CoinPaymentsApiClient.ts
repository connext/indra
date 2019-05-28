import * as crypto from 'crypto'
import { default as fetch } from 'node-fetch'

import { default as Config } from '../Config'
import { NgrokService } from '../NgrokService'

const COINPAYMENTS_API_URL = 'https://www.coinpayments.net/api.php'

export interface CPGetCallbackAddressResponse {
  address: string
  pubkey?: string
  dest_tag?: number
}

export function encodeQueryString(obj: any): string {
  return Object
    .entries(obj)
    .map(([key, val]: any) => `${encodeURIComponent(key)}=${encodeURIComponent(val)}`)
    .join('&')
}

export class CoinPaymentsApiClient {
  
  constructor(
    private config: Config,
    private ngrok: NgrokService,
  ) {}

  async _getIPNUrl(user: string) {
    let baseUrl = this.config.hubPublicUrl
    if (!baseUrl && this.config.isDev)
      baseUrl = await this.ngrok.getDevPublicUrl()

    if (!baseUrl)
      throw new Error('HUB_PUBLIC_URL not defined or (if this is dev) ngrok not working')

    if (!user)
      throw new Error('Refusing to create an IPN URL without a user: ' + JSON.stringify(user))

    return `${baseUrl.replace(/\/*$/, '')}/coinpayments/ipn/${user}`
  }

  async _call(cmd: string, args: any = {}): Promise<any> {
    args = {
      ...args,
      cmd,
      key: this.config.coinpaymentsApiKey,
      format: 'json',
      version: 1,
    }

    const data = encodeQueryString(args)
    const sig = this._sign(this.config.coinpaymentsApiSecret, data)

    const resp = await fetch(COINPAYMENTS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'HMAC': sig,
      },
      body: data,
    })

    const res = await resp.json()
    if (res.error != 'ok') {
      throw new Error('CoinPayments returned an erorr: ' + JSON.stringify(res))
    }

    return res.result
  }

  _sign(secret: string, data: string) {
    const hmac = crypto.createHmac('sha512', secret)
    hmac.update(data)
    return hmac.digest('hex')
  }

  public async getBasicInfo() {
    // https://www.coinpayments.net/apidoc-get-basic-info
    return this._call('get_basic_info') as Promise<{
      username: string
      merchant_id: string
      email: string
      public_name: string
    }>
  }

  public async getCallbackAddress(user: string, currency: string) {
    // https://www.coinpayments.net/apidoc-get-callback-address
    return this._call('get_callback_address', {
      currency,
      ipn_url: await this._getIPNUrl(user),
      label: `${user}: ${currency}`,
    }) as Promise<CPGetCallbackAddressResponse>
  }

  public async getCoinsAndRates() {
    // https://www.coinpayments.net/apidoc-rates
    return this._call('rates', {
      accepted: '1',
    }) as Promise<any>
  }
}
