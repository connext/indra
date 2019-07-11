import { IMessagingService } from "@connext/messaging";
import {
  AppRegistry,
  CreateChannelResponse,
  GetChannelResponse,
  GetConfigResponse,
  SupportedApplication,
  SupportedNetwork,
} from "@connext/types";
import { Address, Node as NodeTypes } from "@counterfactual/types";
import { Subscription } from "ts-nats";
import uuid = require("uuid");

import { Logger } from "./lib/logger";
import { NodeInitializationParameters } from "./types";
import { Wallet } from "./wallet";

// TODO: move to types.ts?
const API_TIMEOUT = 5000;

export interface INodeApiClient {
  config(): Promise<GetConfigResponse>;
  appRegistry(appDetails?: {
    name: SupportedApplication;
    network: SupportedNetwork;
  }): Promise<AppRegistry>;
  authenticate(): void; // TODO: implement!
  getChannel(): Promise<GetChannelResponse>;
  createChannel(): Promise<CreateChannelResponse>;
  subscribeToExchangeRates(from: string, to: string, store: NodeTypes.IStoreService): Promise<void>;
}

type ExchangeSubscription = {
  from: string;
  to: string;
  subscription: Subscription;
};

export class NodeApiClient implements INodeApiClient {
  public messaging: IMessagingService;
  public wallet: Wallet;
  public address: Address;
  public log: Logger;
  public nonce: string | undefined;
  public signature: string | undefined;
  public publicIdentifier: string | undefined;

  // subscription references
  public exchangeSubscriptions: ExchangeSubscription[] | undefined;

  constructor(opts: NodeInitializationParameters) {
    this.messaging = opts.messaging;
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

  public async appRegistry(appDetails?: {
    name: SupportedApplication;
    network: SupportedNetwork;
  }): Promise<AppRegistry> {
    try {
      const registryRes = await this.send("app-registry", appDetails);
      return registryRes as AppRegistry;
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

  // TODO: types for exchange rates and store?
  // TODO: is this the best way to set the store for diff types
  // of tokens
  public async subscribeToExchangeRates(
    from: string,
    to: string,
    store: NodeTypes.IStoreService,
  ): Promise<void> {
    const subscription = await this.messaging.subscribe(
      `exchange-rate.${from}.${to}`,
      (err: any, msg: any) => {
        if (err) {
          this.log.error(JSON.stringify(err, null, 2));
        } else {
          store.set([
            {
              key: `${msg.pattern}-${Date.now().toString()}`,
              value: msg.data,
            },
          ]);
          return msg.data;
        }
      },
    );
    this.exchangeSubscriptions.push({
      from,
      subscription,
      to,
    });
  }

  public async unsubscribeFromExchangeRates(from: string, to: string): Promise<void> {
    if (!this.exchangeSubscriptions || this.exchangeSubscriptions.length === 0) {
      return;
    }

    const matchedSubs = this.exchangeSubscriptions.filter((sub: ExchangeSubscription) => {
      return sub.from === from && sub.to === to;
    });

    if (matchedSubs.length === 0) {
      this.log.warn(`Could not find subscription for ${from}:${to} pair`);
      return;
    }

    matchedSubs.forEach((sub: ExchangeSubscription) => sub.subscription.unsubscribe());
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
    const msg = await this.messaging.request(subject, API_TIMEOUT, {
      data,
      id: uuid.v4(),
    });
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
