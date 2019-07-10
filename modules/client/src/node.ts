import {
  CreateChannelResponse,
  GetChannelResponse,
  GetConfigResponse,
  SupportedApplication,
  SupportedNetwork,
} from "@connext/types";
import { Address } from "@counterfactual/types";
import { Client as NatsClient } from "ts-nats";
import uuid = require("uuid");

import { Logger } from "./lib/logger";
import { NodeInitializationParameters } from "./types";
import { Wallet } from "./wallet";

// TODO: move to types.ts?
const API_TIMEOUT = 1000;

export interface INodeApiClient {
  config(): Promise<GetConfigResponse>;
  appRegistry(name: SupportedApplication, network: SupportedNetwork): Promise<string>;
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

  ///// Setters
  public setPublicIdentifier(publicIdentifier: string): void {
    this.publicIdentifier = publicIdentifier;
  }

  ///// Endpoints
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

  public async appRegistry(name: SupportedApplication, network: SupportedNetwork): Promise<string> {
    try {
      const registryRes = await this.send("app-registry", {
        name,
        network,
      });
      console.log("\n\n******** registry res", registryRes, "\n\n");
      return registryRes as string;
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
    this.log.info(
      `Sending request to ${subject} ${
        data ? `with data: ${JSON.stringify(data, null, 2)}` : `without data`
      }`,
    );
    const msg = await this.nats.request(subject, API_TIMEOUT, {
      data,
      id: uuid.v4(),
    });
    this.log.info(`\n\n msg: ${JSON.stringify(msg, null, 2)}`);
    if (!msg.data) {
      console.log("could this message be malformed?", JSON.stringify(msg, null, 2));
      return undefined;
    }
    const { err, response, ...rest } = msg.data;
    if (err) {
      throw new Error(`Error sending request. Message: ${JSON.stringify(msg, null, 2)}`);
    }
    return Object.keys(response).length === 0 ? undefined : response;
  }
}
