import { Address } from "@counterfactual/types";
import { Client as NatsClient } from "ts-nats";
import { NodeConfig, User, GetChannelResponse, CreateChannelResponse } from "@connext/types";

import { Logger } from "./lib/logger";
import { NodeInitializationParameters } from "./types";
import { Wallet } from "./wallet";

// TODO: move to types.ts?
const API_TIMEOUT = 5000;

export interface INodeApiClient {
  config(): Promise<NodeConfig>;
  authenticate(): void; // TODO: implement!
  getChannel(): Promise<GetChannelResponse>;
  createChannel(): Promise<CreateChannelResponse>;
}

export class NodeApiClient implements INodeApiClient {
  public nodeUrl: string;
  public nats: NatsClient; // TODO: rename to messaging?
  public wallet: Wallet;
  public address: Address;
  public log: Logger;
  public nonce: string | undefined;
  public signature: string | undefined;
  public publicIdentifier: string;

  constructor(opts: NodeInitializationParameters) {
    this.nodeUrl = opts.nodeUrl;
    this.nats = opts.nats;
    this.wallet = opts.wallet;
    this.address = opts.wallet.address;
    this.log = new Logger("NodeApiClient", opts.logLevel);
    this.publicIdentifier = opts.publicIdentifier;
  }

  ///////////////////////////////////
  //////////// PUBLIC //////////////
  /////////////////////////////////

  public async config(): Promise<NodeConfig> {
    // get the config from the hub
    try {
      const configRes = await this.send("config.get");
      // handle error here
      return configRes.data as NodeConfig;
    } catch (e) {
      return Promise.reject(e);
    }
  }

  // TODO: NATS authentication procedure?
  // Use TLS based auth, eventually tied to HNS
  // names, for 2.0-2.x will need to generate our
  // own certs linked to their public key
  public authenticate(): void {}

  public async getChannel(): Promise<GetChannelResponse> {
    try {
      const channelRes = await this.send(`channel.get.${this.publicIdentifier}`);
      // handle error here
      return JSON.parse(channelRes.data);
    } catch (e) {
      return Promise.reject(e);
    }
  }

  // TODO: can we abstract this try-catch thing into a separate function?
  public async createChannel(): Promise<CreateChannelResponse> {
    try {
      const channelRes = await this.send(`channel.create.${this.publicIdentifier}`);
      // handle error here
      return JSON.parse(channelRes.data);
    } catch (e) {
      return Promise.reject(e);
    }
  }

  ///////////////////////////////////
  //////////// PRIVATE /////////////
  /////////////////////////////////
  private async send(subject: string, data?: any): Promise<any> {
    console.log(`Sending request to ${subject} ${data ? `with body: ${data}` : `without body`}`);
    const msg = await this.nats.request(subject, API_TIMEOUT, JSON.stringify(data));
    return JSON.parse(msg.data);
  }
}
