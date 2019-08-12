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
import uuid = require("uuid");

import { Logger } from "./lib/logger";
import { NodeInitializationParameters } from "./types";

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
  getLatestSwapRate(from: string, to: string): Promise<string>;
  requestCollateral(assetId: string): Promise<void>;
  resolveLinkedTransfer(
    paymentId: string,
    preImage: string,
    amount: string,
    assetId: string,
  ): Promise<void>;
  recipientOnline(recipientPublicIdentifier: string): Promise<boolean>;
  subscribeToSwapRates(from: string, to: string, callback: any): void;
  unsubscribeFromSwapRates(from: string, to: string): void;
}

// NOTE: swap rates are given as a decimal string describing:
// Given 1 unit of `from`, how many units `to` are recieved.
// eg the rate string might be "202.02" if 1 eth can be swapped for 202.02 dai

export class NodeApiClient implements INodeApiClient {
  public messaging: IMessagingService;
  public latestSwapRates: { [key: string]: string } = {};
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
    return (await this.send("app-registry", appDetails)) as AppRegistry;
  }

  public async config(): Promise<GetConfigResponse> {
    return (await this.send("config.get")) as GetConfigResponse;
  }

  public async createChannel(): Promise<CreateChannelResponse> {
    return await this.send(`channel.create.${this.userPublicIdentifier}`);
  }

  public async getChannel(): Promise<GetChannelResponse> {
    return await this.send(`channel.get.${this.userPublicIdentifier}`);
  }

  // TODO: do we want this? thought this would be a blocking operation...
  public async getLatestSwapRate(from: string, to: string): Promise<string> {
    return await this.send(`swap-rate.${from}.${to}`);
  }

  // TODO: right now node doesnt return until the deposit has completed
  // which exceeds the timeout.....
  public async requestCollateral(assetId: string): Promise<void> {
    try {
      return await this.send(`channel.request-collateral.${this.userPublicIdentifier}`, {
        assetId,
      });
    } catch (e) {
      // TODO: node should return once deposit starts
      if (e.message.startsWith("Request timed out")) {
        this.log.info(`request collateral message timed out`);
        return;
      }
      throw e;
    }
  }

  public async resolveLinkedTransfer(
    paymentId: string,
    preImage: string,
    amount: string,
    assetId: string,
  ): Promise<void> {
    return await this.send(`transfer.resolve-linked.${this.userPublicIdentifier}`, {
      amount,
      assetId,
      paymentId,
      preImage,
    });
  }

  // TODO: best way to check hub side for limitations?
  // otherwise could be a security flaw
  // FIXME: return type
  public async addPaymentProfile(profile: PaymentProfile): Promise<PaymentProfile> {
    return await this.send(`channel.add-profile.${this.userPublicIdentifier}`, profile);
  }

  // NOTE: maybe move?
  public recipientOnline = async (recipientPublicIdentifier: string): Promise<boolean> => {
    try {
      return await this.send(`online.${recipientPublicIdentifier}`);
    } catch (e) {
      if (e.message.startsWith("Request timed out")) {
        return false;
      }
      throw e;
    }
  };

  public setUserPublicIdentifier(publicIdentifier: string): void {
    this.userPublicIdentifier = publicIdentifier;
  }

  public setNodePublicIdentifier(publicIdentifier: string): void {
    this.nodePublicIdentifier = publicIdentifier;
  }

  public subscribeToSwapRates(from: string, to: string, callback: any): void {
    this.messaging.subscribe(`swap-rate.${from}.${to}`, callback);
  }

  public unsubscribeFromSwapRates(from: string, to: string): void {
    this.messaging.unsubscribe(`swap-rate.${from}.${to}`);
  }

  ////////////////////////////////////////
  // PRIVATE

  private async send(subject: string, data?: any): Promise<any | undefined> {
    this.log.debug(
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
    const isEmptyObj = typeof response === "object" && Object.keys(response).length === 0;
    return !response || isEmptyObj ? undefined : response;
  }
}
