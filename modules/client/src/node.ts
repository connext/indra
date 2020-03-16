import { MessagingService } from "@connext/messaging";
import { ILoggerService, ResolveFastSignedTransferResponse } from "@connext/types";
import axios, { AxiosResponse } from "axios";
import { TransactionResponse } from "ethers/providers";
import { Transaction } from "ethers/utils";
import uuid from "uuid";
import { logTime, NATS_ATTEMPTS, NATS_TIMEOUT, stringify, delay } from "./lib";
import {
  AppRegistry,
  CFCoreTypes,
  ChannelAppSequences,
  CreateChannelResponse,
  GetChannelResponse,
  GetConfigResponse,
  IChannelProvider,
  INodeApiClient,
  makeChecksumOrEthAddress,
  NodeInitializationParameters,
  RebalanceProfile,
  PendingAsyncTransfer,
  RequestCollateralResponse,
  ResolveLinkedTransferResponse,
  Transfer,
} from "./types";
import { invalidXpub } from "./validation";

const sendFailed = "Failed to send message";

// NOTE: swap rates are given as a decimal string describing:
// Given 1 unit of `from`, how many units `to` are received.
// eg the rate string might be "202.02" if 1 eth can be swapped for 202.02 dai

export class NodeApiClient implements INodeApiClient {
  public messaging: MessagingService;
  public latestSwapRates: { [key: string]: string } = {};
  public log: ILoggerService;

  private _userPublicIdentifier: string | undefined;
  private _nodePublicIdentifier: string | undefined;
  private _channelProvider: IChannelProvider | undefined;
  private nodeUrl: string;

  constructor(opts: NodeInitializationParameters) {
    this.messaging = opts.messaging as MessagingService;
    this.log = opts.logger.newContext("NodeApiClient");
    this._userPublicIdentifier = opts.userPublicIdentifier;
    this._nodePublicIdentifier = opts.nodePublicIdentifier;
    this._channelProvider = opts.channelProvider;
    this.nodeUrl = opts.nodeUrl;
  }

  public static async config(nodeUrl: string): Promise<GetConfigResponse> {
    const response: AxiosResponse<GetConfigResponse> = await axios.get(`${nodeUrl}/config`);
    return response.data;
  }

  ////////////////////////////////////////
  // GETTERS/SETTERS
  get channelProvider(): IChannelProvider | undefined {
    return this._channelProvider;
  }

  set channelProvider(channelProvider: IChannelProvider) {
    this._channelProvider = channelProvider;
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
    const lockValue = await this.send(`${this.userPublicIdentifier}.lock.acquire.${lockName}`, {
      lockTTL: timeout,
    });
    this.log.debug(`Acquired lock at ${Date.now()} for ${lockName} with secret ${lockValue}`);
    let retVal: any;
    try {
      retVal = await callback();
    } catch (e) {
      this.log.error(`Failed to execute callback while lock is held: ${e.stack || e.message}`);
    } finally {
      await this.send(`${this.userPublicIdentifier}.lock.release.${lockName}`, { lockValue });
      this.log.debug(`Released lock at ${Date.now()} for ${lockName}`);
    }
    return retVal;
  }

  public async appRegistry(): Promise<AppRegistry> {
    const response: AxiosResponse<AppRegistry> = await axios.get(`${this.nodeUrl}/app-registry`);
    return response.data;
  }

  public async config(): Promise<GetConfigResponse> {
    const response: AxiosResponse<GetConfigResponse> = await axios.get(`${this.nodeUrl}/config`);
    return response.data;
  }

  public async createChannel(): Promise<CreateChannelResponse> {
    return await this.send(`${this.userPublicIdentifier}.channel.create`);
  }

  public async getChannel(): Promise<GetChannelResponse> {
    return await this.send(`${this.userPublicIdentifier}.channel.get`);
  }

  public async getPendingAsyncTransfers(): Promise<PendingAsyncTransfer[]> {
    return (await this.send(`${this.userPublicIdentifier}.transfer.get-pending`)) || [];
  }

  // TODO: do we want this? thought this would be a blocking operation...
  public async getLatestSwapRate(from: string, to: string): Promise<string> {
    return await this.send(`swap-rate.${from}.${to}`);
  }

  public async getTransferHistory(): Promise<Transfer[]> {
    return (await this.send(`${this.userPublicIdentifier}.transfer.get-history`)) || [];
  }

  // TODO: right now node doesnt return until the deposit has completed
  // which exceeds the timeout.....
  public async requestCollateral(assetId: string): Promise<RequestCollateralResponse | void> {
    try {
      return await this.send(`${this.userPublicIdentifier}.channel.request-collateral`, {
        assetId,
      });
    } catch (e) {
      // TODO: node should return once deposit starts
      if (e.message.startsWith("Request timed out")) {
        this.log.warn("request collateral message timed out");
        return;
      }
      throw e;
    }
  }

  public async withdraw(tx: CFCoreTypes.MinimalTransaction): Promise<TransactionResponse> {
    return await this.send(`${this.userPublicIdentifier}.channel.withdraw`, {
      tx,
    });
  }

  public async fetchLinkedTransfer(paymentId: string): Promise<any> {
    return await this.send(`${this.userPublicIdentifier}.transfer.fetch-linked`, {
      paymentId,
    });
  }

  public async resolveLinkedTransfer(paymentId: string): Promise<ResolveLinkedTransferResponse> {
    return await this.send(`${this.userPublicIdentifier}.transfer.resolve-linked`, {
      paymentId,
    });
  }

  public async resolveFastSignedTransfer(
    paymentId: string,
  ): Promise<ResolveFastSignedTransferResponse> {
    return await this.send(`${this.userPublicIdentifier}.transfer.resolve-fast-signed`, {
      paymentId,
    });
  }

  public async resolveHashLockTransfer(lockHash: string): Promise<ResolveHashLockTransferResponse> {
    return await this.send(`transfer.resolve-hashlock.${this.userPublicIdentifier}`, {
      lockHash,
    });
  }

  public async getRebalanceProfile(assetId?: string): Promise<RebalanceProfile> {
    return await this.send(`${this.userPublicIdentifier}.channel.get-profile`, {
      assetId: makeChecksumOrEthAddress(assetId),
    });
  }

  public async verifyAppSequenceNumber(appSequenceNumber: number): Promise<ChannelAppSequences> {
    return await this.send(`${this.userPublicIdentifier}.channel.verify-app-sequence`, {
      userAppSequenceNumber: appSequenceNumber,
    });
  }

  // NOTE: maybe move since its not directly to the node just through messaging?
  // TODO -- What needs to happen here for JWT auth refactor?
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
    const ret = invalidXpub(publicIdentifier);
    if (ret !== undefined) {
      throw new Error(ret);
    }
    this.userPublicIdentifier = publicIdentifier;
  }

  public setNodePublicIdentifier(publicIdentifier: string): void {
    const ret = invalidXpub(publicIdentifier);
    if (ret !== undefined) {
      throw new Error(ret);
    }
    this.nodePublicIdentifier = publicIdentifier;
  }

  public async subscribeToSwapRates(from: string, to: string, callback: any): Promise<void> {
    await this.messaging.subscribe(`swap-rate.${from}.${to}`, callback);
  }

  public async unsubscribeFromSwapRates(from: string, to: string): Promise<void> {
    await this.messaging.unsubscribe(`swap-rate.${from}.${to}`);
  }

  // TODO: type
  public async restoreState(): Promise<any> {
    return this.send(`${this.userPublicIdentifier}.channel.restore-states`);
  }

  public async getLatestWithdrawal(): Promise<Transaction> {
    return await this.send(`${this.userPublicIdentifier}.channel.latestWithdrawal`);
  }

  public async clientCheckIn(): Promise<void> {
    return await this.send(`${this.userPublicIdentifier}.client.check-in`);
  }

  ////////////////////////////////////////
  // PRIVATE

  private async send(subject: string, data?: any): Promise<any | undefined> {
    let error;
    for (let attempt = 1; attempt <= NATS_ATTEMPTS; attempt += 1) {
      try {
        return await this.sendAttempt(subject, data);
      } catch (e) {
        error = e;
        if (e.message.startsWith(sendFailed)) {
          this.log.warn(
            `Attempt ${attempt}/${NATS_ATTEMPTS} to send ${subject} failed: ${e.message}`,
          );
          await this.messaging.disconnect();
          await this.messaging.connect();
          if (attempt + 1 <= NATS_ATTEMPTS) {
            await delay(NATS_TIMEOUT); // Wait at least a NATS_TIMEOUT before retrying
          }
        } else {
          throw e;
        }
      }
    }
    throw error;
  }

  private async sendAttempt(subject: string, data?: any): Promise<any | undefined> {
    const start = Date.now();
    this.log.debug(
      `Sending request to ${subject} ${data ? `with data: ${stringify(data)}` : "without data"}`,
    );
    const payload = {
      ...data,
      id: uuid.v4(),
    };
    let msg: any;
    try {
      msg = await this.messaging.request(subject, NATS_TIMEOUT, payload);
    } catch (e) {
      throw new Error(`${sendFailed}: ${e.message}`);
    }
    const parsedData = typeof msg.data === "string" ? JSON.parse(msg.data) : msg.data;
    let error = msg ? (parsedData ? (parsedData.response ? parsedData.response.err : "") : "") : "";
    if (!parsedData) {
      this.log.info(`Maybe this message is malformed: ${stringify(msg)}`);
      return undefined;
    }
    const { err, response } = parsedData;
    if (err || error || parsedData.err) {
      throw new Error(`Error sending request to subject ${subject}. Message: ${stringify(msg)}`);
    }
    const isEmptyObj = typeof response === "object" && Object.keys(response).length === 0;
    logTime(
      this.log,
      start,
      `Node responded to ${subject.split(".").slice(0, 2).join(".")} request`, // prettier-ignore
    );
    return !response || isEmptyObj ? undefined : response;
  }
}
