import { MessagingService } from "@connext/messaging";
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
  ConditionalTransferTypes,
} from "@connext/types";
import { bigNumberifyJson, isNode, logTime, stringify } from "@connext/utils";
import axios, { AxiosResponse } from "axios";
import { utils, providers, BigNumberish, BigNumber } from "ethers";
import { v4 as uuid } from "uuid";

import { createCFChannelProvider } from "./channelProvider";

const { getAddress } = utils;

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
      messaging: providedMessaging,
      chainId,
      middlewareMap,
    } = opts;
    // Don't sync channel on startup by default
    const skipSync = typeof opts.skipSync === "boolean" ? opts.skipSync : true;
    const log = logger.newContext("NodeApiClient");

    const nodeUrl = opts.nodeUrl;

    // If no messagingUrl given, attempt to derive one from the nodeUrl
    const nodeHost = nodeUrl.replace(/^.*:\/\//, "").replace(/\/.*/, "");
    const messagingUrl =
      opts.messagingUrl ||
      (isNode()
        ? `nats://${nodeHost.replace(/:[0-9]+$/, "")}:4222`
        : nodeUrl.startsWith("https://")
        ? `wss://${nodeHost}/api/messaging`
        : `ws://${nodeHost}/api/messaging`);

    if (!opts.messagingUrl) {
      log.info(`No messagingUrl provided, using ${messagingUrl} derived from nodeUrl ${nodeUrl}`);
    } else {
      log.debug(`Initializing messaging with nodeUrl ${nodeUrl} & messagingUrl ${messagingUrl}`);
    }

    if (signer) {
      getSignature = (msg: string) => signer.signMessage(msg);
      userIdentifier = signer.publicIdentifier;
    } else if (providedChannelProvider) {
      getSignature = async (message: string) =>
        providedChannelProvider.send(ChannelMethods.chan_signMessage, { message });
      userIdentifier = providedChannelProvider.config.userIdentifier;
    } else {
      throw new Error("Must provide channelProvider or signer");
    }

    if (!providedMessaging) {
      messaging = new MessagingService(
        {
          messagingUrl,
          logger: log.newContext("Messaging"),
        },
        "INDRA",
        () => NodeApiClient.getBearerToken(nodeUrl, userIdentifier, getSignature),
      );
    } else {
      messaging = providedMessaging;
    }
    await messaging.connect();

    const node = new NodeApiClient({ ...opts, nodeUrl, messaging });
    const config = await node.getConfig();
    if (config.ethNetwork.chainId !== chainId) {
      throw new Error(
        `Node config does not include info for ${chainId}, only for ${config.ethNetwork.chainId}`,
      );
    }
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
        middlewareMap,
        logger: log,
        store: opts.store,
        skipSync,
      });
      log.debug(`Using channelProvider config: ${stringify(channelProvider.config)}`);
      node.channelProvider = channelProvider;
    }
    return node;
  }

  public chainId: number;
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
    this.chainId = parseInt(opts.chainId.toString(), 10);
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

  async acquireLock(lockName: string): Promise<string> {
    return this.send(
      `${this.userIdentifier}.${this.nodeIdentifier}.${this.chainId}.lock.acquire.${lockName}`,
    );
  }

  async releaseLock(lockName: string, lockValue: string): Promise<void> {
    return this.send(
      `${this.userIdentifier}.${this.nodeIdentifier}.${this.chainId}.lock.release.${lockName}`,
      {
        lockValue,
      },
    );
  }

  public async appRegistry(): Promise<AppRegistry> {
    const response: AxiosResponse<AppRegistry> = await axios.get(
      `${this.nodeUrl}/app-registry/${this.chainId}`,
    );
    return response.data;
  }

  public async getConfig(): Promise<NodeResponses.GetConfig> {
    const { data: config }: AxiosResponse<NodeResponses.GetConfig> = await axios.get(
      `${this.nodeUrl}/config/${this.chainId}`,
    );
    this.config = config;
    this.nodeIdentifier = config.nodeIdentifier;
    return config;
  }

  public async createChannel(): Promise<NodeResponses.CreateChannel> {
    return this.send(
      `${this.userIdentifier}.${this.nodeIdentifier}.${this.chainId}.channel.create`,
    );
  }

  public async getChannel(): Promise<NodeResponses.GetChannel> {
    return this.send(`${this.userIdentifier}.${this.nodeIdentifier}.${this.chainId}.channel.get`);
  }

  // FIXME: endpoint commented out on node
  // public async getPendingAsyncTransfers(): Promise<NodeResponses.GetPendingAsyncTransfers> {
  //   return (
  //     (await this.send(`${this.userIdentifier}.${this.nodeIdentifier}.transfer.get-pending`)) || []
  //   );
  // }

  public async installPendingTransfers(): Promise<NodeResponses.GetPendingAsyncTransfers> {
    const extendedTimeout = NATS_TIMEOUT * 5;
    return (
      (await this.send(
        `${this.userIdentifier}.${this.nodeIdentifier}.${this.chainId}.transfer.install-pending`,
        extendedTimeout,
      )) || []
    );
  }

  public async getLatestSwapRate(from: string, to: string): Promise<string> {
    return this.send(
      `${this.userIdentifier}.${this.nodeIdentifier}.swap-rate.${from}.${to}.${this.chainId}.${this.chainId}`,
    );
  }

  public async getTransferHistory(): Promise<NodeResponses.GetTransferHistory> {
    return (
      (await this.send(
        `${this.userIdentifier}.${this.nodeIdentifier}.${this.chainId}.transfer.get-history`,
      )) || []
    );
  }

  public async getHashLockTransfer(
    lockHash: string,
    assetId: string,
  ): Promise<NodeResponses.GetHashLockTransfer> {
    return this.send(
      `${this.userIdentifier}.${this.nodeIdentifier}.${this.chainId}.transfer.get-hashlock`,
      {
        lockHash,
        assetId,
      },
    );
  }

  public async requestCollateral(
    assetId: string,
    amount?: BigNumberish,
  ): Promise<NodeResponses.RequestCollateral> {
    return this.send(
      `${this.userIdentifier}.${this.nodeIdentifier}.${this.chainId}.channel.request-collateral`,
      {
        assetId,
        amount: amount ? BigNumber.from(amount).toString() : undefined,
      },
    );
  }

  public async fetchLinkedTransfer(paymentId: string): Promise<any> {
    return this.send(
      `${this.userIdentifier}.${this.nodeIdentifier}.${this.chainId}.transfer.get-linked`,
      {
        paymentId,
      },
    );
  }

  public async fetchSignedTransfer(paymentId: string): Promise<any> {
    return this.send(
      `${this.userIdentifier}.${this.nodeIdentifier}.${this.chainId}.transfer.get-signed`,
      {
        paymentId,
      },
    );
  }

  public async fetchGraphTransfer(paymentId: string): Promise<any> {
    return this.send(
      `${this.userIdentifier}.${this.nodeIdentifier}.${this.chainId}.transfer.get-graph`,
      {
        paymentId,
      },
    );
  }

  public async installConditionalTransferReceiverApp(
    paymentId: string,
    conditionType: ConditionalTransferTypes,
  ): Promise<NodeResponses.InstallConditionalTransferReceiverApp> {
    this.log.info(`Start installConditionalTransferReceiverApp for ${paymentId}: ${conditionType}`);
    const extendedTimeout = NATS_TIMEOUT * 5; // 55s
    return this.send(
      `${this.userIdentifier}.${this.nodeIdentifier}.${this.chainId}.transfer.install-receiver`,
      {
        paymentId,
        conditionType,
      },
      extendedTimeout,
    );
  }

  public async resolveLinkedTransfer(
    paymentId: string,
  ): Promise<NodeResponses.ResolveLinkedTransfer> {
    // add a special timeout here, because this request could include
    // up to the following protocols:
    // - propose (DepositApp)
    // - install (DepositApp)
    // - onchain tx (collateral)
    // - uninstall (DepositApp)
    // - propose (LinkedTransfer)
    // if the user is not already collateralized
    const extendedTimeout = NATS_TIMEOUT * 5; // 55s
    return this.send(
      `${this.userIdentifier}.${this.nodeIdentifier}.${this.chainId}.transfer.install-linked`,
      {
        paymentId,
      },
      extendedTimeout,
    );
  }

  public async resolveSignedTransfer(
    paymentId: string,
  ): Promise<NodeResponses.ResolveSignedTransfer> {
    // add extended timeout in case receiver uncollateralized and multiple
    // protocols are run (see comments in `resolveLinkedTransfer` for details)
    const extendedTimeout = NATS_TIMEOUT * 5; // 55s
    return this.send(
      `${this.userIdentifier}.${this.nodeIdentifier}.${this.chainId}.transfer.install-signed`,
      {
        paymentId,
      },
      extendedTimeout,
    );
  }

  public async getRebalanceProfile(assetId?: string): Promise<NodeResponses.GetRebalanceProfile> {
    return this.send(
      `${this.userIdentifier}.${this.nodeIdentifier}.${this.chainId}.channel.get-profile`,
      {
        assetId: getAddress(assetId),
      },
    );
  }

  public async subscribeToSwapRates(from: string, to: string, callback: any): Promise<void> {
    await this.messaging.subscribe(`swap-rate.${from}.${to}`, callback);
  }

  public async unsubscribeFromSwapRates(from: string, to: string): Promise<void> {
    await this.messaging.unsubscribe(`swap-rate.${from}.${to}`);
  }

  public async restoreState(): Promise<NodeResponses.ChannelRestore> {
    return this.send(
      `${this.userIdentifier}.${this.nodeIdentifier}.${this.chainId}.channel.restore`,
    );
  }

  public async getLatestWithdrawal(): Promise<providers.TransactionRequest> {
    return this.send(
      `${this.userIdentifier}.${this.nodeIdentifier}.${this.chainId}.channel.latestWithdrawal`,
    );
  }

  public async clientCheckIn(): Promise<void> {
    return this.send(
      `${this.userIdentifier}.${this.nodeIdentifier}.${this.chainId}.client.check-in`,
    );
  }

  public async cancelChallenge(
    appIdentityHash: string,
    signature: string,
  ): Promise<NodeResponses.CancelChallenge> {
    return this.send(
      `${this.userIdentifier}.${this.nodeIdentifier}.${this.chainId}.challenge.cancel`,
      { signature, appIdentityHash },
    );
  }

  ////////////////////////////////////////
  // PRIVATE

  private async send(
    subject: string,
    data?: any,
    timeout: number = NATS_TIMEOUT,
  ): Promise<any | undefined> {
    const start = Date.now();
    const payload = {
      ...data,
      id: uuid(),
    };
    let msg: any;
    try {
      msg = await this.messaging.request(subject, timeout, payload);
    } catch (e) {
      throw new Error(`Failed to send message: ${e.message || e}`);
    }
    const parsedData = typeof msg.data === "string" ? JSON.parse(msg.data) : msg.data;
    const error = msg
      ? parsedData
        ? parsedData.response
          ? parsedData.response.err
          : ""
        : ""
      : "";
    if (!parsedData) {
      this.log.info(`Could not parse data, is this message malformed? ${stringify(msg)}`);
      return undefined;
    }
    const { err, response } = parsedData;
    if (err || error || parsedData.err) {
      throw new Error(`Error sending request to subject ${subject}. Message: ${stringify(msg)}`);
    }
    const isEmptyObj = typeof response === "object" && Object.keys(response).length === 0;
    logTime(this.log, start, `Node responded to ${subject} request`);
    return !response || isEmptyObj ? undefined : bigNumberifyJson(response);
  }
}
