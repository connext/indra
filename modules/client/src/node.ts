import { IMessagingService } from "@connext/messaging";
import {
  AppRegistry,
  CreateChannelResponse,
  GetChannelResponse,
  GetConfigResponse,
  PaymentProfile,
  SupportedApplication,
  SupportedNetwork,
} from "@connext/types";
import { Node as NodeTypes } from "@counterfactual/types";
import { BigNumber } from "ethers/utils";
import uuid = require("uuid");

import { Logger } from "./lib/logger";
import { NodeInitializationParameters } from "./types";

// TODO: move to types.ts?
const API_TIMEOUT = 5000;

export interface INodeApiClient {
  addPaymentProfile(profile: PaymentProfile): Promise<PaymentProfile>;
  appRegistry(appDetails?: {
    name: SupportedApplication;
    network: SupportedNetwork;
  }): Promise<AppRegistry>;
  config(): Promise<GetConfigResponse>;
  createChannel(): Promise<CreateChannelResponse>;
  getChannel(): Promise<GetChannelResponse>;
  getLatestSwapRate(from: string, to: string): BigNumber;
  requestCollateral(tokenAddress: string): Promise<void>;
  subscribeToSwapRates(from: string, to: string, store: NodeTypes.IStoreService): Promise<void>;
  unsubscribeFromSwapRates(from: string, to: string): Promise<void>;
}

export class NodeApiClient implements INodeApiClient {
  public messaging: IMessagingService;
  public latestSwapRates: { [key: string]: BigNumber };
  public log: Logger;
  public userPublicIdentifier: string | undefined;
  public nodePublicIdentifier: string | undefined;

  constructor(opts: NodeInitializationParameters) {
    this.messaging = opts.messaging;
    this.log = new Logger("NodeApiClient", opts.logLevel);
    this.userPublicIdentifier = opts.userPublicIdentifier;
    this.nodePublicIdentifier = opts.nodePublicIdentifier;
  }

  ////////////////////////////////////////
  // PUBLIC

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

  public async getChannel(): Promise<GetChannelResponse> {
    try {
      const channelRes = await this.send(`channel.get.${this.userPublicIdentifier}`);
      // handle error here
      return channelRes;
    } catch (e) {
      return Promise.reject(e);
    }
  }

  // TODO: can we abstract this try-catch thing into a separate function?
  public async createChannel(): Promise<CreateChannelResponse> {
    try {
      const channelRes = await this.send(`channel.create.${this.userPublicIdentifier}`);
      // handle error here
      return channelRes;
    } catch (e) {
      return Promise.reject(e);
    }
  }

  public getLatestSwapRate = (from: string, to: string): BigNumber => {
    const latestRate = this.latestSwapRates[`exchange-rate.${from}.${to}`];
    if (!latestRate) {
      throw new Error(`No exchange rate from ${from} to ${to} has been recieved yet`);
    }
    return latestRate;
  };

  // FIXME: right now node doesnt return until the deposit has completed
  // which exceeds the timeout.....
  public async requestCollateral(tokenAddress: string): Promise<void> {
    try {
      const channelRes = await this.send(
        `channel.request-collateral.${this.userPublicIdentifier}`,
        { tokenAddress },
      );
      return channelRes;
    } catch (e) {
      // FIXME: node should return once deposit starts
      if (e.message.startsWith("Request timed out")) {
        this.log.info(`request collateral message timed out`);
        return;
      }
      return Promise.reject(e);
    }
  }

  // TODO: best way to check hub side for limitations?
  // otherwise could be a security flaw
  // FIXME: return type
  public async addPaymentProfile(profile: PaymentProfile): Promise<PaymentProfile> {
    try {
      const profileRes = await this.send(
        `channel.add-profile.${this.userPublicIdentifier}`,
        profile,
      );
      return profileRes;
    } catch (e) {
      return Promise.reject(e);
    }
  }

  public setUserPublicIdentifier(publicIdentifier: string): void {
    this.userPublicIdentifier = publicIdentifier;
  }

  public setNodePublicIdentifier(publicIdentifier: string): void {
    this.nodePublicIdentifier = publicIdentifier;
  }

  // TODO: types for exchange rates and store?
  // TODO: is this the best way to set the store for diff types
  // of tokens
  public async subscribeToSwapRates(
    from: string,
    to: string,
    store: NodeTypes.IStoreService,
  ): Promise<void> {
    await this.messaging.subscribe(`exchange-rate.${from}.${to}`, (msg: any) => {
      store.set([
        {
          key: `${msg.pattern}-${Date.now().toString()}`,
          value: msg.data,
        },
      ]);
      this.latestSwapRates[`exchange-rate.${from}.${to}`] = new BigNumber(msg.data);
    });
  }

  public async unsubscribeFromSwapRates(from: string, to: string): Promise<void> {
    return this.messaging.unsubscribe(`exchange-rate.${from}.${to}`);
  }

  ////////////////////////////////////////
  // PRIVATE

  private async send(subject: string, data?: any): Promise<any | undefined> {
    this.log.info(
      `Sending request to ${subject} ${
        data ? `with data: ${JSON.stringify(data, null, 2)}` : `without data`
      }`,
    );
    const msg = await this.messaging.request(subject, API_TIMEOUT, {
      ...data,
      id: uuid.v4(),
    });
    if (!msg.data) {
      console.log("could this message be malformed?", JSON.stringify(msg, null, 2));
      return undefined;
    }
    const { err, response, ...rest } = msg.data;
    const responseErr = response && response.err;
    if (err || responseErr) {
      throw new Error(`Error sending request. Message: ${JSON.stringify(msg, null, 2)}`);
    }
    return !response || Object.keys(response).length === 0 ? undefined : response;
  }
}
