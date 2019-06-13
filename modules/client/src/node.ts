import { Address } from "@counterfactual/types";
import { Logger } from "./lib/logger";
import { Wallet } from "./wallet"
import { NodeConfig, } from "./types";
import { Client as NatsClient } from "ts-nats";
// TODO: use npm package
import { INatsMessaging } from "../../nats-messaging-client";

// TODO: move to types.tx?
const API_TIMEOUT = 30000;
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export interface INodeApiClient {
  config(): Promise<NodeConfig>
}

export class NodeApiClient implements INodeApiClient {
  private nodeUrl: string;
  private nats: NatsClient // TODO: rename to messaging?
  private wallet: Wallet;
  private address: Address;
  private log: Logger;
  private nonce: string | undefined;
  private signature: string | undefined;

  constructor(
    nodeUrl: string,
    nats: INatsMessaging, // connected in `connect` of client
    wallet: Wallet,
    logLevel?: number,
  ) {
    this.nodeUrl = nodeUrl;
    this.nats = nats.getConnection();
    this.wallet = wallet;
    this.address = wallet.address;
    this.log = new Logger('NodeApiClient', logLevel);
  }

  ///////////////////////////////////
  //////////// PUBLIC //////////////
  /////////////////////////////////

  public async config(): Promise<NodeConfig> {
    // get the config from the hub
    try {
      const configRes: NodeConfig = await this.send("config")
      return configRes
    } catch (e) {
      return Promise.reject(e)
    }
  }

  // TODO: NATS authentication procedure?
  // Use TLS based auth, eventually tied to HNS
  // names, for 2.0-2.x will need to generate our
  // own certs linked to their public key
  public authenticate(): void {
  }


  ///////////////////////////////////
  //////////// PRIVATE /////////////
  /////////////////////////////////
  private async send(subject: string, body?: any): Promise<any> {
    const msg = await this.nats.request(subject, API_TIMEOUT, body);
    return msg;
  }
}