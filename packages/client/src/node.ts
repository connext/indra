import { Address } from "@counterfactual/types";
import { Logger } from "./lib/logger";
import { Wallet } from "ethers"
import { NodeConfig } from "./types";

export interface INodeApiClient {
  config(): Promise<NodeConfig>
}

export class NodeApiClient implements INodeApiClient {
  private nodeUrl: string;
  // private address: Address;
  private log: Logger;
  private nonce: string | undefined;
  private signature: string | undefined;
  // private wallet: Wallet;


  constructor(nodeUrl: string, /*wallet: Wallet,*/ logLevel?: number) {
    this.nodeUrl = nodeUrl;
    this.log = new Logger('NodeApiClient', logLevel);
    // this.address = wallet.address;
    // this.wallet = wallet;
  }

  ///////////////////////////////////
  //////////// PUBLIC //////////////
  /////////////////////////////////
  public config(): Promise<NodeConfig> {
    // get the config from the hub

  }

  // TODO: NATS authentication
  public authenticate(): void {
  }


  ///////////////////////////////////
  //////////// PRIVATE /////////////
  /////////////////////////////////
  private async get(url: string): Promise<any> {
    return this.send('GET', url)
  }

  private async post(url: string, body: any): Promise<any> {
    return this.send('POST', url, body)
  }

  private async send(method: string, url: string, body?: any): Promise<any> {
    const opts: any = {
      headers: {
        // 'x-address': this.address,
        'x-nonce': this.nonce,
        'x-signature': this.signature,
      },
      method,
      mode: 'cors',
    }
    if (method === 'POST') {
      opts.body = JSON.stringify(body)
      opts.headers['Content-Type'] = 'application/json'
    }

    let res = await fetch(`${this.nodeUrl}/${url}`, opts)

    if (res.status === 403 && url !== `${this.nodeUrl}/nonce`) {
      this.log.info(`Got a 403, let's re-authenticate and try again`)
      await this.authenticate()
      opts.headers['x-nonce'] = this.nonce
      opts.headers['x-signature'] = this.signature
      res = await fetch(`${this.nodeUrl}/${url}`, opts)
    }

    if (res.status === 204) { return undefined }
    if (res.status >= 200 && res.status <= 299) {
      const json = await res.json()
      return json ? json : undefined
    }

    let text
    try {
      text = await res.text()
    } catch (e) {
      text = res.statusText
    }
    throw({
      body: res.body,
      message: `Received non-200 response: ${text}`,
      status: res.status,
    })

  }

}