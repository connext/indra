import { CreateChannelResponse, GetChannelResponse, GetConfigResponse } from "@connext/types";
import { Address } from "@counterfactual/types";
import { Client as NatsClient } from "ts-nats";

import { Logger } from "./lib/logger";
import { NodeInitializationParameters } from "./types";
import { Wallet } from "./wallet";

// TODO: move to types.ts?
const API_TIMEOUT = 5000;

export interface INodeApiClient {
  config(): Promise<GetConfigResponse>;
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
  public publicIdentifier: string | undefined;

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

  public setPublicIdentifier(publicIdentifier: string): void {
    this.publicIdentifier = publicIdentifier;
  }

  public async config(): Promise<GetConfigResponse> {
    // get the config from the hub
    try {
      const configRes = await this.send("config.get");
      // handle error here
      return configRes as GetConfigResponse;
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
      return channelRes;
    } catch (e) {
      return Promise.reject(e);
    }
  }

  // TODO: can we abstract this try-catch thing into a separate function?
  public async createChannel(): Promise<CreateChannelResponse> {
    try {
      const channelRes = await this.send(`channel.create.${this.publicIdentifier}`);
      // handle error here
      return channelRes;
    } catch (e) {
      return Promise.reject(e);
    }
  }

  ///////////////////////////////////
  //////////// PRIVATE /////////////
  /////////////////////////////////
  private async send(subject: string, data?: any): Promise<any | undefined> {
    console.log(`Sending request to ${subject} ${data ? `with body: ${data}` : `without body`}`);
    const msg = await this.nats.request(subject, API_TIMEOUT, JSON.stringify(data));
    if (!msg.data) {
      console.log("could this message be malformed?", JSON.stringify(msg, null, 2));
      return undefined;
    }
    const { status, ...res } = msg.data;
    if (status !== "success") {
      throw new Error(`Error sending request. Res: ${JSON.stringify(msg, null, 2)}`);
    }
    return Object.keys(res).length === 0 ? undefined : res.data;
  }
}
