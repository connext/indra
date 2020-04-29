import {
  AppRegistry,
  IChannelProvider,
  ILoggerService,
  IMessagingService,
  INodeApiClient,
  NATS_TIMEOUT,
  NodeResponses,
  StringMapping,
  ChannelMethods,
  NodeInitializationParameters,
  AsyncNodeInitializationParameters,
  VerifyNonceDtoType,
  Address,
} from "@connext/types";
import { bigNumberifyJson, logTime, stringify, formatMessagingUrl } from "@connext/utils";
import axios, { AxiosResponse } from "axios";
import { Transaction, utils } from "ethers";
import { v4 as uuid } from "uuid";

import { createCFChannelProvider } from "./channelProvider";
import { MessagingService } from "@connext/messaging";

const sendFailed = "Failed to send message";

// NOTE: swap rates are given as a decimal string describing:
// Given 1 unit of `from`, how many units `to` are received.
// eg the rate string might be "202.02" if 1 eth can be swapped for 202.02 dai

export class NodeApiClient implements INodeApiClient {
  public static async getBearerToken(
    nodeUrl: string,
    userIdentifier: Address,
    getSignature: (nonce: string) => Promise<string>,
  ): Promise<string> {
    const nonceResponse: AxiosResponse<string> = await axios.get(
      `${nodeUrl}/auth/${userIdentifier}`,
    );
    const nonce = nonceResponse.data;
    const sig = await getSignature(nonce);
    const verifyResponse: AxiosResponse<string> = await axios.post(`${nodeUrl}/auth`, {
      sig,
      userIdentifier,
    } as VerifyNonceDtoType);
    return verifyResponse.data;
  }

  public static async init(opts: AsyncNodeInitializationParameters) {
    let getSignature: (msg: string) => Promise<string>;
    let userIdentifier: string;
    let messaging: IMessagingService;
    let channelProvider: IChannelProvider;
    const {
      ethProvider,
      channelProvider: providedChannelProvider,
      signer,
      logger,
      nodeUrl,
      messaging: providedMessaging,
      messagingUrl,
    } = opts;

    if (signer) {
      getSignature = (msg: string) => signer.signMessage(msg);
      userIdentifier = signer.publicIdentifier;
    } else if (providedChannelProvider) {
      getSignature = async (message: string) => {
        const sig = await providedChannelProvider.send(ChannelMethods.chan_signMessage, {
          message,
        });
        return sig;
      };
      userIdentifier = providedChannelProvider.config.userIdentifier;
    } else {
      throw new Error("Must provide channelProvider or signer");
    }

    if (!providedMessaging) {
      messaging = new MessagingService(
        {
          messagingUrl: messagingUrl || formatMessagingUrl(nodeUrl),
          logger,
        },
        "INDRA",
        () => NodeApiClient.getBearerToken(nodeUrl, userIdentifier, getSignature),
      );
    } else {
      messaging = providedMessaging;
    }
    await messaging.connect();

    const node = new NodeApiClient({ ...opts, messaging });
    const config = await node.getConfig();
    node.userIdentifier = userIdentifier;

    if (!providedChannelProvider) {
      // ensure that node and user identifiers are different
      if (config.nodeIdentifier === signer.publicIdentifier) {
        throw new Error(
          "Client must be instantiated with a signer that is different from the node's",
        );
      }

      if (!opts.store) {
        "Client must be instanatied with a store if no channelProvider is available";
      }

      channelProvider = await createCFChannelProvider({
        ethProvider,
        signer,
        node,
        logger,
        store: opts.store,
      });
      logger.debug(`Using channelProvider config: ${stringify(channelProvider.config)}`);
      node.channelProvider = channelProvider;
    }
    return node;
  }

  public nodeUrl: string;
  public messaging: IMessagingService;
  public latestSwapRates: StringMapping = {};
  public log: ILoggerService;

  private _userIdentifier: string | undefined;
  private _nodeIdentifier: string | undefined;
  private _config: NodeResponses.GetConfig | undefined;
  private _channelProvider: IChannelProvider | undefined;

  constructor(opts: NodeInitializationParameters) {
    this.messaging = opts.messaging;
    this.log = opts.logger.newContext("NodeApiClient");
    this._userIdentifier = opts.userIdentifier;
    this._nodeIdentifier = opts.nodeIdentifier;
    this._channelProvider = opts.channelProvider;
    this.nodeUrl = opts.nodeUrl;
  }

  ////////////////////////////////////////
  // GETTERS/SETTERS
  get userIdentifier(): string | undefined {
    return this._userIdentifier;
  }

  set userIdentifier(userAddress: string) {
    this._userIdentifier = userAddress;
  }

  get nodeIdentifier(): string | undefined {
    return this._nodeIdentifier;
  }

  set nodeIdentifier(nodeAddress: string) {
    this._nodeIdentifier = nodeAddress;
  }

  get config(): NodeResponses.GetConfig | undefined {
    return this._config;
  }

  set config(config: NodeResponses.GetConfig) {
    this._config = config;
  }

  get channelProvider(): IChannelProvider | undefined {
    return this._channelProvider;
  }

  set channelProvider(channelProvider: IChannelProvider) {
    this._channelProvider = channelProvider;
  }

  ////////////////////////////////////////
  // PUBLIC

  async acquireLock(
    lockName: string,
    callback: (...args: any[]) => any,
    timeout: number,
  ): Promise<any> {
    const lockValue = await this.send(`${this.userIdentifier}.lock.acquire.${lockName}`, {
      lockTTL: timeout,
    });
    this.log.debug(`Acquired lock at ${Date.now()} for ${lockName} with secret ${lockValue}`);
    let retVal: any;
    try {
      retVal = await callback();
    } catch (e) {
      this.log.error(`Failed to execute callback while lock is held: ${e.stack || e.message}`);
    } finally {
      await this.send(`${this.userIdentifier}.lock.release.${lockName}`, { lockValue });
      this.log.debug(`Released lock at ${Date.now()} for ${lockName}`);
    }
    return retVal;
  }

  public async appRegistry(): Promise<AppRegistry> {
    const response: AxiosResponse<AppRegistry> = await axios.get(`${this.nodeUrl}/app-registry`);
    return response.data;
  }

  public async getConfig(): Promise<NodeResponses.GetConfig> {
    const { data: config }: AxiosResponse<NodeResponses.GetConfig> = await axios.get(
      `${this.nodeUrl}/config`,
    );
    this.config = config;
    this.nodeIdentifier = config.nodeIdentifier;
    return config;
  }

  public async createChannel(): Promise<NodeResponses.CreateChannel> {
    return this.send(`${this.userIdentifier}.channel.create`);
  }

  public async getChannel(): Promise<NodeResponses.GetChannel> {
    return this.send(`${this.userIdentifier}.channel.get`);
  }

  public async getPendingAsyncTransfers(): Promise<NodeResponses.GetPendingAsyncTransfers> {
    return (await this.send(`${this.userIdentifier}.transfer.get-pending`)) || [];
  }

  public async getLatestSwapRate(from: string, to: string): Promise<string> {
    return this.send(`${this.userIdentifier}.swap-rate.${from}.${to}`);
  }

  public async getTransferHistory(): Promise<NodeResponses.GetTransferHistory> {
    return (await this.send(`${this.userIdentifier}.transfer.get-history`)) || [];
  }

  public async getHashLockTransfer(
    lockHash: string,
    assetId: string,
  ): Promise<NodeResponses.GetHashLockTransfer> {
    return this.send(`${this.userIdentifier}.transfer.get-hashlock`, {
      lockHash,
      assetId,
    });
  }

  // TODO: right now node doesnt return until the deposit has completed
  // which exceeds the timeout.....
  public async requestCollateral(assetId: string): Promise<NodeResponses.RequestCollateral | void> {
    try {
      return this.send(`${this.userIdentifier}.channel.request-collateral`, {
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

  public async fetchLinkedTransfer(paymentId: string): Promise<any> {
    return this.send(`${this.userIdentifier}.transfer.get-linked`, {
      paymentId,
    });
  }

  public async fetchSignedTransfer(paymentId: string): Promise<any> {
    return this.send(`${this.userIdentifier}.transfer.get-signed`, {
      paymentId,
    });
  }

  public async resolveLinkedTransfer(
    paymentId: string,
  ): Promise<NodeResponses.ResolveLinkedTransfer> {
    return this.send(`${this.userIdentifier}.transfer.install-linked`, {
      paymentId,
    });
  }

  public async resolveSignedTransfer(
    paymentId: string,
  ): Promise<NodeResponses.ResolveSignedTransfer> {
    return this.send(`${this.userIdentifier}.transfer.install-signed`, {
      paymentId,
    });
  }

  public async getRebalanceProfile(assetId?: string): Promise<NodeResponses.GetRebalanceProfile> {
    return this.send(`${this.userIdentifier}.channel.get-profile`, {
      assetId: utils.getAddress(assetId),
    });
  }

  // NOTE: maybe move since its not directly to the node just through messaging?
  // TODO -- What needs to happen here for JWT auth refactor?
  public recipientOnline = async (recipientIdentifier: string): Promise<boolean> => {
    try {
      return this.send(`online.${recipientIdentifier}`);
    } catch (e) {
      if (e.message.startsWith("Request timed out")) {
        return false;
      }
      throw e;
    }
  };

  public async subscribeToSwapRates(from: string, to: string, callback: any): Promise<void> {
    await this.messaging.subscribe(`swap-rate.${from}.${to}`, callback);
  }

  public async unsubscribeFromSwapRates(from: string, to: string): Promise<void> {
    await this.messaging.unsubscribe(`swap-rate.${from}.${to}`);
  }

  public async restoreState(): Promise<NodeResponses.ChannelRestore> {
    return this.send(`${this.userIdentifier}.channel.restore`);
  }

  public async getLatestWithdrawal(): Promise<Transaction> {
    return this.send(`${this.userIdentifier}.channel.latestWithdrawal`);
  }

  public async clientCheckIn(): Promise<void> {
    return this.send(`${this.userIdentifier}.client.check-in`);
  }

  ////////////////////////////////////////
  // PRIVATE

  private async send(subject: string, data?: any): Promise<any | undefined> {
    return this.sendAttempt(subject, data);
  }

  private async sendAttempt(subject: string, data?: any): Promise<any | undefined> {
    const start = Date.now();
    const payload = {
      ...data,
      id: uuid(),
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
      this.log.info(`Could not parse data, is this message malformed? ${stringify(msg)}`);
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
    return !response || isEmptyObj ? undefined : bigNumberifyJson(response);
  }
}
