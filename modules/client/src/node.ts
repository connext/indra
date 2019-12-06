import { IMessagingService } from "@connext/messaging";
import { TransactionResponse } from "ethers/providers";
import { Transaction } from "ethers/utils";
import uuid = require("uuid");

import { ChannelRouter } from "./channelRouter";
import { Logger, NATS_TIMEOUT, stringify } from "./lib";
import {
  AppRegistry,
  CFCoreTypes,
  ChannelAppSequences,
  CreateChannelResponse,
  GetChannelResponse,
  GetConfigResponse,
  makeChecksumOrEthAddress,
  NodeInitializationParameters,
  PaymentProfile,
  RequestCollateralResponse,
  SupportedApplication,
  SupportedNetwork,
  Transfer,
} from "./types";

// Include our access token when interacting with these subjects
const guardedSubjects = ["channel", "lock", "transfer"];

export interface INodeApiClient {
  acquireLock(lockName: string, callback: (...args: any[]) => any, timeout: number): Promise<any>;
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
  getTransferHistory(publicIdentifier: string): Promise<Transfer[]>;
  requestCollateral(assetId: string): Promise<RequestCollateralResponse | void>;
  withdraw(tx: CFCoreTypes.MinimalTransaction): Promise<TransactionResponse>;
  fetchLinkedTransfer(paymentId: string): Promise<any>;
  resolveLinkedTransfer(
    paymentId: string,
    preImage: string,
    recipientPublicIdentifier?: string,
  ): Promise<void>;
  recipientOnline(recipientPublicIdentifier: string): Promise<boolean>;
  restoreState(publicIdentifier: string): Promise<any>;
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

  private _userPublicIdentifier: string | undefined;
  private _nodePublicIdentifier: string | undefined;
  private _channelRouter: ChannelRouter | undefined;
  private token: Promise<string> | undefined;

  constructor(opts: NodeInitializationParameters) {
    this.messaging = opts.messaging;
    this.log = new Logger("NodeApiClient", opts.logLevel);
    this._userPublicIdentifier = opts.userPublicIdentifier;
    this._nodePublicIdentifier = opts.nodePublicIdentifier;
    this._channelRouter = opts.channelRouter;
    if (this.channelRouter) {
      this.token = this.getAuthToken();
    }
  }

  ////////////////////////////////////////
  // GETTERS/SETTERS
  get channelRouter(): ChannelRouter | undefined {
    return this._channelRouter;
  }

  set channelRouter(channelRouter: ChannelRouter) {
    this._channelRouter = channelRouter;
  }

  get userPublicIdentifier(): string | undefined {
    return this._userPublicIdentifier;
  }

  set userPublicIdentifier(userXpub: string) {
    this._userPublicIdentifier = userXpub;
  }

  get nodePublicIdentifier(): string | undefined {
    return this._nodePublicIdentifier;
  }

  set nodePublicIdentifier(nodeXpub: string) {
    this._nodePublicIdentifier = nodeXpub;
  }

  ////////////////////////////////////////
  // PUBLIC

  async acquireLock(
    lockName: string,
    callback: (...args: any[]) => any,
    timeout: number,
  ): Promise<any> {
    const lockValue = await this.send(`lock.acquire.${lockName}`, { lockTTL: timeout });
    this.log.debug(`Acquired lock at ${Date.now()} for ${lockName} with secret ${lockValue}`);
    let retVal: any;
    try {
      retVal = await callback();
    } catch (e) {
      this.log.error("Failed to execute callback while lock is held");
      this.log.error(e);
    } finally {
      await this.send(`lock.release.${lockName}`, { lockValue });
      this.log.debug(`Released lock at ${Date.now()} for ${lockName}`);
    }
    return retVal;
  }

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

  public async getPendingAsyncTransfers(): Promise<
    {
      assetId: string;
      amount: string;
      encryptedPreImage: string;
      linkedHash: string;
      paymentId: string;
    }[]
  > {
    return (await this.send(`transfer.get-pending.${this.userPublicIdentifier}`)) || [];
  }

  // TODO: do we want this? thought this would be a blocking operation...
  public async getLatestSwapRate(from: string, to: string): Promise<string> {
    return await this.send(`swap-rate.${from}.${to}`);
  }

  public async getTransferHistory(): Promise<Transfer[]> {
    return (await this.send(`transfer.get-history.${this.userPublicIdentifier}`)) || [];
  }

  // TODO: right now node doesnt return until the deposit has completed
  // which exceeds the timeout.....
  public async requestCollateral(assetId: string): Promise<RequestCollateralResponse | void> {
    try {
      return await this.send(`channel.request-collateral.${this.userPublicIdentifier}`, {
        assetId,
      });
    } catch (e) {
      // TODO: node should return once deposit starts
      if (e.message.startsWith("Request timed out")) {
        this.log.warn(`request collateral message timed out`);
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

  public async fetchLinkedTransfer(paymentId: string): Promise<any> {
    return await this.send(`transfer.fetch-linked.${this.userPublicIdentifier}`, {
      paymentId,
    });
  }

  public async resolveLinkedTransfer(
    paymentId: string,
    preImage: string,
    recipientPublicIdentifier?: string,
  ): Promise<void> {
    return await this.send(`transfer.resolve-linked.${this.userPublicIdentifier}`, {
      paymentId,
      preImage,
      recipientPublicIdentifier,
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

  public async setRecipientAndEncryptedPreImageForLinkedTransfer(
    recipientPublicIdentifier: string,
    encryptedPreImage: string,
    linkedHash: string,
  ): Promise<any> {
    return await this.send(`transfer.set-recipient.${this.userPublicIdentifier}`, {
      encryptedPreImage,
      linkedHash,
      recipientPublicIdentifier,
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

  public async subscribeToSwapRates(from: string, to: string, callback: any): Promise<void> {
    await this.messaging.subscribe(`swap-rate.${from}.${to}`, callback);
  }

  public async unsubscribeFromSwapRates(from: string, to: string): Promise<void> {
    await this.messaging.unsubscribe(`swap-rate.${from}.${to}`);
  }

  // TODO: type
  public async restoreState(publicIdentifier: string): Promise<any> {
    return this.send(`channel.restore-states.${publicIdentifier}`);
  }

  public async getLatestWithdrawal(): Promise<Transaction> {
    return await this.send(`channel.latestWithdrawal.${this.userPublicIdentifier}`);
  }

  ////////////////////////////////////////
  // PRIVATE

  private async getAuthToken(): Promise<string> {
    return new Promise(
      async (resolve: any, reject: any): Promise<any> => {
        const nonce = await this.send("auth.getNonce", {
          address: this.channelRouter.signerAddress,
        });
        const sig = await this.channelRouter.signMessage(nonce);
        const token = `${nonce}:${sig}`;
        return resolve(token);
      },
    );
  }

  private assertAuthToken(): void {
    if (!this.channelRouter) {
      throw new Error(
        `Must have instantiated a channel router (ie a signing thing) before setting auth token`,
      );
    }
    if (!this.token) {
      this.token = this.getAuthToken();
    }
  }

  private async send(subject: string, data?: any): Promise<any | undefined> {
    this.log.debug(
      `Sending request to ${subject} ${data ? `with data: ${stringify(data)}` : `without data`}`,
    );
    const payload = {
      ...data,
      id: uuid.v4(),
    };
    if (guardedSubjects.includes(subject.split(".")[0])) {
      this.assertAuthToken();
      payload.token = await this.token;
    }
    let msg = await this.messaging.request(subject, NATS_TIMEOUT, payload);
    let error = msg ? (msg.data ? (msg.data.response ? msg.data.response.err : "") : "") : "";
    if (error && error.startsWith("Invalid token")) {
      this.log.info(`Auth error, token might have expired. Let's get a fresh token & try again.`);
      this.token = this.getAuthToken();
      payload.token = await this.token;
      msg = await this.messaging.request(subject, NATS_TIMEOUT, payload);
      error = msg ? (msg.data ? (msg.data.response ? msg.data.response.err : "") : "") : "";
    }
    if (!msg.data) {
      this.log.info(`Maybe this message is malformed: ${stringify(msg)}`);
      return undefined;
    }
    const { err, response, ...rest } = msg.data;
    if (err || error) {
      throw new Error(`Error sending request. Message: ${stringify(msg)}`);
    }
    const isEmptyObj = typeof response === "object" && Object.keys(response).length === 0;
    return !response || isEmptyObj ? undefined : response;
  }
}
