import { IMessagingService } from "@connext/messaging";
import {
  AppRegistry,
  ChannelAppSequences,
  CreateChannelResponse,
  GetChannelResponse,
  GetConfigResponse,
  makeChecksumOrEthAddress,
  PaymentProfile,
  SupportedApplication,
  SupportedNetwork,
} from "@connext/types";
import { Node as CFCoreTypes } from "@counterfactual/types";
import { TransactionResponse } from "ethers/providers";
import uuid = require("uuid");

import { Logger } from "./lib/logger";
import { replaceBN } from "./lib/utils";
import { NodeInitializationParameters } from "./types";

const API_TIMEOUT = 35_000;

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
  getPaymentProfile(assetId?: string): Promise<PaymentProfile>;
  requestCollateral(assetId: string): Promise<void>;
  withdraw(tx: CFCoreTypes.MinimalTransaction): Promise<TransactionResponse>;
  resolveLinkedTransfer(
    paymentId: string,
    preImage: string,
    amount: string,
    assetId: string,
  ): Promise<void>;
  recipientOnline(recipientPublicIdentifier: string): Promise<boolean>;
  subscribeToSwapRates(from: string, to: string, callback: any): void;
  unsubscribeFromSwapRates(from: string, to: string): void;
  // TODO: fix types
  verifyAppSequenceNumber(appSequenceNumber: number): Promise<ChannelAppSequences>;
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
    this.auth();
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

  public async withdraw(tx: CFCoreTypes.MinimalTransaction): Promise<TransactionResponse> {
    return await this.send(`channel.withdraw.${this.userPublicIdentifier}`, {
      tx,
    });
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

  public async addPaymentProfile(profile: PaymentProfile): Promise<PaymentProfile> {
    return await this.send(`channel.add-profile.${this.userPublicIdentifier}`, profile);
  }

  public async getPaymentProfile(assetId?: string): Promise<PaymentProfile> {
    return await this.send(`channel.get-profile.${this.userPublicIdentifier}`, {
      assetId: makeChecksumOrEthAddress(assetId),
    });
  }

  public async verifyAppSequenceNumber(appSequenceNumber: number): Promise<ChannelAppSequences> {
    return await this.send(`channel.verify-app-sequence.${this.userPublicIdentifier}`, {
      userAppSequenceNumber: appSequenceNumber,
    });
  }

  // NOTE: maybe move since its not directly to the node just through messaging?
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

  // TODO: need to add auth for this!
  public async restoreStates(publicIdentifier: string): Promise<{ path: string; value: object }[]> {
    return this.send(`channel.restore-states.${publicIdentifier}`);
  }

  ////////////////////////////////////////
  // PRIVATE

  private async auth(): Promise<any> {
    console.log(`Sending auth message`);
    const res = await this.send("auth.get");
    return console.log(`Auth result: ${JSON.stringify(res)}`);
  }

  private async send(subject: string, data?: any): Promise<any | undefined> {
    this.log.debug(
      `Sending request to ${subject} ${
        data ? `with data: ${JSON.stringify(data, replaceBN, 2)}` : `without data`
      }`,
    );
    const msg = await this.messaging.request(subject, API_TIMEOUT, {
      ...data,
      id: uuid.v4(),
    });
    if (!msg.data) {
      this.log.info(`Maybe this message is malformed: ${JSON.stringify(msg, replaceBN, 2)}`);
      return undefined;
    }
    const { err, response, ...rest } = msg.data;
    const responseErr = response && response.err;
    if (err || responseErr) {
      throw new Error(`Error sending request. Message: ${JSON.stringify(msg, replaceBN, 2)}`);
    }
    const isEmptyObj = typeof response === "object" && Object.keys(response).length === 0;
    return !response || isEmptyObj ? undefined : response;
  }
}
