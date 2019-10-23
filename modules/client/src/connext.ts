import { IMessagingService, MessagingServiceFactory } from "@connext/messaging";
import {
  AppActionBigNumber,
  AppRegistry,
  AppState,
  AppStateBigNumber,
  CFCoreChannel,
  ChannelAppSequences,
  ChannelProviderConfig,
  ChannelState,
  ConditionalTransferParameters,
  ConditionalTransferResponse,
  ConnextEvent,
  ConnextNodeStorePrefix,
  CreateChannelResponse,
  DepositParameters,
  GetChannelResponse,
  GetConfigResponse,
  makeChecksum,
  makeChecksumOrEthAddress,
  PaymentProfile,
  RegisteredAppDetails,
  ResolveConditionParameters,
  ResolveConditionResponse,
  ResolveLinkedTransferResponse,
  RpcType,
  SupportedApplication,
  SupportedNetwork,
  SwapParameters,
  Transfer,
  TransferParameters,
  WithdrawParameters,
} from "@connext/types";
import MinimumViableMultisig from "@counterfactual/cf-funding-protocol-contracts/expected-build-artifacts/MinimumViableMultisig.json";
import Proxy from "@counterfactual/cf-funding-protocol-contracts/expected-build-artifacts/Proxy.json";
import { Address, AppInstanceJson, Node as CFCoreTypes } from "@counterfactual/types";
import "core-js/stable";
import EthCrypto from "eth-crypto";
import { Contract, providers, Wallet } from "ethers";
import { AddressZero } from "ethers/constants";
import {
  BigNumber,
  bigNumberify,
  getAddress,
  Interface,
  keccak256,
  Network,
  solidityKeccak256,
  Transaction,
} from "ethers/utils";
import { fromMnemonic } from "ethers/utils/hdnode";
import tokenAbi from "human-standard-token-abi";
import "regenerator-runtime/runtime";

import { ChannelRouter } from "./channelRouter";
import { ConditionalTransferController } from "./controllers/ConditionalTransferController";
import { DepositController } from "./controllers/DepositController";
import { ResolveConditionController } from "./controllers/ResolveConditionController";
import { SwapController } from "./controllers/SwapController";
import { TransferController } from "./controllers/TransferController";
import { WithdrawalController } from "./controllers/WithdrawalController";
import { CFCore, CreateChannelMessage, EXTENDED_PRIVATE_KEY_PATH } from "./lib/cfCore";
import { CF_PATH } from "./lib/constants";
import { Logger } from "./lib/logger";
import {
  freeBalanceAddressFromXpub,
  publicIdentifierToAddress,
  replaceBN,
  withdrawalKey,
  xkeysToSortedKthAddresses,
} from "./lib/utils";
import { ConnextListener } from "./listener";
import { NodeApiClient } from "./node";
import { ClientOptions, InternalClientOptions, Store } from "./types";
import { invalidAddress } from "./validation/addresses";
import { falsy, notLessThanOrEqualTo, notPositive } from "./validation/bn";

const MAX_WITHDRAWAL_RETRIES = 3;

/**
 * Creates a new client-node connection with node at specified url
 *
 * @param opts The options to instantiate the client with.
 * At a minimum, must contain the nodeUrl and a client signing key or mnemonic
 */

export async function connect(opts: ClientOptions): Promise<ConnextInternal> {
  const {
    logLevel,
    ethProviderUrl,
    mnemonic,
    natsClusterId,
    nodeUrl,
    natsToken,
    store,
    channelProvider,
  } = opts;
  const logger = new Logger("ConnextConnect", logLevel);

  // setup network information
  const ethProvider = new providers.JsonRpcProvider(ethProviderUrl);
  const network = await ethProvider.getNetwork();

  // special case for ganache
  if (network.chainId === 4447) {
    network.name = "ganache";
    // Enforce using provided signer, not via RPC
    ethProvider.getSigner = (addressOrIndex?: string | number): any => {
      throw { code: "UNSUPPORTED_OPERATION" };
    };
  }

  // set provider config
  let providerConfig: ChannelProviderConfig;
  if (channelProvider) {
    // enable the channel provider, which sets the config property
    await channelProvider.enable();
    providerConfig = {
      ...channelProvider.config,
      type: RpcType.ChannelProvider,
    };
  } else if (mnemonic) {
    // generate extended private key from mnemonic
    const hdNode = fromMnemonic(mnemonic);
    const xpriv = hdNode.extendedKey;
    const xpub = hdNode.derivePath(CF_PATH).neuter().extendedKey;
    await store.set([{ path: EXTENDED_PRIVATE_KEY_PATH, value: xpriv }]);
    providerConfig = {
      freeBalanceAddress: freeBalanceAddressFromXpub(xpub),
      natsClusterId,
      natsToken,
      nodeUrl,
      signerAddress: hdNode.derivePath(CF_PATH).address,
      type: RpcType.CounterfactualNode,
      userPublicIdentifier: xpub,
    } as any;
  } else {
    throw new Error(`Must provide a channel provider or mnemonic on startup.`);
  }

  logger.info(`using provider config: ${JSON.stringify(providerConfig, null, 2)}`);

  logger.info(`Creating messaging service client (logLevel: ${logLevel})`);
  const messagingFactory = new MessagingServiceFactory({
    clusterId: providerConfig.natsClusterId,
    logLevel,
    messagingUrl: providerConfig.nodeUrl,
    token: providerConfig.natsToken,
  });
  const messaging = messagingFactory.createService("messaging");
  await messaging.connect();
  logger.info("Messaging service is connected");

  // create a new node api instance
  logger.info("creating node api client");
  const nodeApiConfig = {
    logLevel,
    messaging,
  };
  const node: NodeApiClient = new NodeApiClient(nodeApiConfig);
  logger.info("created node api client successfully");

  const config = await node.config();
  logger.info(`node is connected to eth network: ${JSON.stringify(config.ethNetwork)}`);
  logger.info(`node config: ${JSON.stringify(config)}`);

  const appRegistry = await node.appRegistry();

  // create the lock service for cfCore
  logger.info("using node's proxy lock service");
  const lockService: CFCoreTypes.ILockService = {
    acquireLock: node.acquireLock.bind(node),
  };

  let channelRouter: ChannelRouter;
  switch (providerConfig.type) {
    case RpcType.ChannelProvider:
      channelRouter = new ChannelRouter(channelProvider!, providerConfig);
      break;

    case RpcType.CounterfactualNode:
      logger.info("creating new cf module");
      const cfCore = await CFCore.create(
        messaging as any, // TODO: FIX
        store,
        {
          STORE_KEY_PREFIX: "store",
        }, // TODO: proper config
        ethProvider,
        config.contractAddresses,
        lockService,
      );
      const signer = await cfCore.signerAddress();
      const wallet = Wallet.fromMnemonic(opts.mnemonic!, CF_PATH);
      logger.info("created cf module successfully");
      logger.info(`cf module signer address: ${signer}`);
      channelRouter = new ChannelRouter(cfCore, providerConfig, store, wallet);
      break;

    default:
      throw new Error(`Unrecognized provider type: ${providerConfig.type}`);
  }

  // set pubids + channel router
  node.channelRouter = channelRouter;
  node.userPublicIdentifier = providerConfig.userPublicIdentifier;
  node.nodePublicIdentifier = config.nodePublicIdentifier;

  const myChannel = await node.getChannel();
  let multisigAddress: string;
  if (!myChannel) {
    logger.info("no channel detected, creating channel..");
    const creationEventData: CFCoreTypes.CreateChannelResult = await new Promise(
      async (res: any, rej: any): Promise<any> => {
        const timer = setTimeout(() => rej("Create channel event not fired within 30s"), 30000);
        channelRouter.once(CFCoreTypes.EventName.CREATE_CHANNEL, (data: CreateChannelMessage) => {
          clearTimeout(timer);
          res(data.data);
        });

        const creationData = await node.createChannel();
        logger.info(`created channel, transaction: ${JSON.stringify(creationData)}`);
      },
    );
    multisigAddress = creationEventData.multisigAddress;
  } else {
    multisigAddress = myChannel.multisigAddress;
  }
  logger.info(`multisigAddress: ${multisigAddress}`);

  channelRouter.multisigAddress = multisigAddress;

  // create the new client
  const client = new ConnextInternal({
    appRegistry,
    channelRouter,
    config,
    ethProvider,
    messaging,
    multisigAddress,
    network,
    node,
    store,
    ...opts, // use any provided opts by default
  });

  await client.registerSubscriptions();

  await client.reclaimPendingAsyncTransfers();

  // make sure there is not an active withdrawal with >= MAX_WITHDRAWAL_RETRIES
  await client.resubmitActiveWithdrawal();

  return client;
}

/**
 * This abstract class contains all methods associated with managing
 * or establishing the user's channel.
 *
 * The true implementation of this class exists in the `ConnextInternal`
 * class
 */
export abstract class ConnextChannel {
  public opts: InternalClientOptions;
  public config: GetConfigResponse;
  private internal: ConnextInternal;

  public constructor(opts: InternalClientOptions) {
    this.opts = opts;
    this.config = opts.config;
    this.internal = this as any;
  }

  ///////////////////////////////////
  // LISTENER METHODS
  public on = (
    event: ConnextEvent | CFCoreTypes.EventName,
    callback: (...args: any[]) => void,
  ): ConnextListener => {
    return this.internal.on(event, callback);
  };

  public emit = (event: ConnextEvent | CFCoreTypes.EventName, data: any): boolean => {
    return this.internal.emit(event, data);
  };

  ///////////////////////////////////
  // CORE CHANNEL METHODS

  public deposit = async (params: DepositParameters): Promise<ChannelState> => {
    return await this.internal.deposit(params);
  };

  public swap = async (params: SwapParameters): Promise<CFCoreChannel> => {
    return await this.internal.swap(params);
  };

  public transfer = async (params: TransferParameters): Promise<CFCoreChannel> => {
    return await this.internal.transfer(params);
  };

  public withdraw = async (params: WithdrawParameters): Promise<ChannelState> => {
    return await this.internal.withdraw(params);
  };

  public resolveCondition = async (
    params: ResolveConditionParameters,
  ): Promise<ResolveConditionResponse> => {
    return await this.internal.resolveCondition(params);
  };

  public conditionalTransfer = async (
    params: ConditionalTransferParameters,
  ): Promise<ConditionalTransferResponse> => {
    return await this.internal.conditionalTransfer(params);
  };

  public restoreState = async (mnemonic: string): Promise<ConnextInternal> => {
    return await this.internal.restoreState(mnemonic);
  };

  public channelProviderConfig = async (): Promise<ChannelProviderConfig> => {
    return this.internal.channelRouter.config;
  };

  ///////////////////////////////////
  // NODE EASY ACCESS METHODS

  public getChannel = async (): Promise<GetChannelResponse> => {
    return await this.internal.node.getChannel();
  };

  public getLinkedTransfer = async (paymentId: string): Promise<any> => {
    return await this.internal.node.fetchLinkedTransfer(paymentId);
  };

  // TODO: do we need to expose here?
  public getAppRegistry = async (appDetails?: {
    name: SupportedApplication;
    network: SupportedNetwork;
  }): Promise<AppRegistry> => {
    return await this.internal.node.appRegistry(appDetails);
  };

  // TODO: do we need to expose here?
  public createChannel = async (): Promise<CreateChannelResponse> => {
    return await this.internal.node.createChannel();
  };

  public subscribeToSwapRates = async (from: string, to: string, callback: any): Promise<any> => {
    return await this.internal.node.subscribeToSwapRates(from, to, callback);
  };

  public getLatestSwapRate = async (from: string, to: string): Promise<string> => {
    return await this.internal.node.getLatestSwapRate(from, to);
  };

  public unsubscribeToSwapRates = async (from: string, to: string): Promise<void> => {
    return await this.internal.node.unsubscribeFromSwapRates(from, to);
  };

  public requestCollateral = async (tokenAddress: string): Promise<void> => {
    return await this.internal.node.requestCollateral(tokenAddress);
  };

  public addPaymentProfile = async (profile: PaymentProfile): Promise<PaymentProfile> => {
    return await this.internal.node.addPaymentProfile(profile);
  };

  public getPaymentProfile = async (assetId?: string): Promise<PaymentProfile | undefined> => {
    return await this.internal.node.getPaymentProfile(assetId);
  };

  public getTransferHistory = async (): Promise<Transfer[]> => {
    return await this.internal.node.getTransferHistory();
  };

  public setRecipientAndEncryptedPreImageForLinkedTransfer = async (
    recipient: string,
    encryptedPreImage: string,
    linkedHash: string,
  ): Promise<any> => {
    return await this.internal.node.setRecipientAndEncryptedPreImageForLinkedTransfer(
      recipient,
      encryptedPreImage,
      linkedHash,
    );
  };

  public reclaimPendingAsyncTransfers = async (): Promise<void> => {
    return await this.internal.reclaimPendingAsyncTransfers();
  };

  public reclaimPendingAsyncTransfer = async (
    paymentId: string,
    encryptedPreImage: string,
  ): Promise<ResolveLinkedTransferResponse> => {
    return await this.internal.reclaimPendingAsyncTransfer(paymentId, encryptedPreImage);
  };

  // does not directly call node function because needs to send
  // some additional information along with the request, as implemented in
  // ConnextInternal
  public verifyAppSequenceNumber = async (): Promise<ChannelAppSequences> => {
    return await this.internal.verifyAppSequenceNumber();
  };

  ///////////////////////////////////
  // CF MODULE EASY ACCESS METHODS

  public providerDeposit = async (
    amount: BigNumber,
    assetId: string,
    notifyCounterparty: boolean = false,
  ): Promise<CFCoreTypes.DepositResult> => {
    return await this.internal.providerDeposit(amount, assetId, notifyCounterparty);
  };

  public getFreeBalance = async (
    assetId: string = AddressZero,
  ): Promise<CFCoreTypes.GetFreeBalanceStateResult> => {
    return await this.internal.getFreeBalance(assetId);
  };

  public getAppInstances = async (): Promise<AppInstanceJson[]> => {
    return await this.internal.getAppInstances();
  };

  public getAppInstanceDetails = async (
    appInstanceId: string,
  ): Promise<CFCoreTypes.GetAppInstanceDetailsResult> => {
    return await this.internal.getAppInstanceDetails(appInstanceId);
  };

  public getAppState = async (appInstanceId: string): Promise<CFCoreTypes.GetStateResult> => {
    return await this.internal.getAppState(appInstanceId);
  };

  public getProposedAppInstances = async (): Promise<
    CFCoreTypes.GetProposedAppInstancesResult | undefined
  > => {
    return await this.internal.getProposedAppInstances();
  };

  public getProposedAppInstance = async (
    appInstanceId: string,
  ): Promise<CFCoreTypes.GetProposedAppInstanceResult | undefined> => {
    return await this.internal.getProposedAppInstance(appInstanceId);
  };

  public proposeInstallApp = async (
    params: CFCoreTypes.ProposeInstallParams,
  ): Promise<CFCoreTypes.ProposeInstallResult> => {
    return await this.internal.proposeInstallApp(params);
  };

  public proposeInstallVirtualApp = async (
    params: CFCoreTypes.ProposeInstallVirtualParams,
  ): Promise<CFCoreTypes.ProposeInstallVirtualResult> => {
    return await this.internal.proposeInstallVirtualApp(params);
  };

  public installVirtualApp = async (
    appInstanceId: string,
  ): Promise<CFCoreTypes.InstallVirtualResult> => {
    return await this.internal.installVirtualApp(appInstanceId);
  };

  public installApp = async (appInstanceId: string): Promise<CFCoreTypes.InstallResult> => {
    return await this.internal.installApp(appInstanceId);
  };

  public rejectInstallApp = async (appInstanceId: string): Promise<CFCoreTypes.UninstallResult> => {
    return await this.internal.rejectInstallApp(appInstanceId);
  };

  public rejectInstallVirtualApp = async (
    appInstanceId: string,
  ): Promise<CFCoreTypes.UninstallVirtualResult> => {
    return await this.internal.rejectInstallVirtualApp(appInstanceId);
  };

  public takeAction = async (
    appInstanceId: string,
    action: AppActionBigNumber,
  ): Promise<CFCoreTypes.TakeActionResult> => {
    return await this.internal.takeAction(appInstanceId, action);
  };

  public updateState = async (
    appInstanceId: string,
    newState: AppState | any, // cast to any bc no supported apps use
    // the update state method
  ): Promise<CFCoreTypes.UpdateStateResult> => {
    return await this.internal.updateState(appInstanceId, newState);
  };

  public uninstallApp = async (appInstanceId: string): Promise<CFCoreTypes.UninstallResult> => {
    return await this.internal.uninstallApp(appInstanceId);
  };

  public uninstallVirtualApp = async (
    appInstanceId: string,
  ): Promise<CFCoreTypes.UninstallVirtualResult> => {
    return await this.internal.uninstallVirtualApp(appInstanceId);
  };

  public cfWithdraw = async (
    amount: BigNumber,
    assetId?: string,
    recipient?: string,
  ): Promise<CFCoreTypes.WithdrawResult> => {
    return await this.internal.cfWithdraw(amount, assetId, recipient);
  };
}

/**
 * True implementation of the connext client
 */
export class ConnextInternal extends ConnextChannel {
  public opts: InternalClientOptions;
  public channelRouter: ChannelRouter;
  public routerType: RpcType;
  public publicIdentifier: string;
  public ethProvider: providers.JsonRpcProvider;
  public node: NodeApiClient;
  public messaging: IMessagingService;
  public multisigAddress: Address;
  public listener: ConnextListener;
  public nodePublicIdentifier: string;
  public freeBalanceAddress: string;
  public appRegistry: AppRegistry;
  public signerAddress: Address;

  public logger: Logger;
  public network: Network;
  public store: Store;

  ////////////////////////////////////////
  // Setup channel controllers
  private depositController: DepositController;
  private transferController: TransferController;
  private swapController: SwapController;
  private withdrawalController: WithdrawalController;
  private conditionalTransferController: ConditionalTransferController;
  private resolveConditionController: ResolveConditionController;

  constructor(opts: InternalClientOptions) {
    super(opts);
    this.opts = opts;
    this.appRegistry = opts.appRegistry;
    this.config = opts.config;
    this.ethProvider = opts.ethProvider;
    this.messaging = opts.messaging;

    this.appRegistry = opts.appRegistry;

    this.channelRouter = opts.channelRouter;
    this.freeBalanceAddress = this.channelRouter.config.freeBalanceAddress;
    this.signerAddress = this.channelRouter.config.signerAddress;
    this.routerType = this.channelRouter.config.type;
    this.network = opts.network;
    this.node = opts.node;
    this.publicIdentifier = this.channelRouter.config.userPublicIdentifier;
    this.multisigAddress = this.opts.multisigAddress;
    this.nodePublicIdentifier = this.opts.config.nodePublicIdentifier;
    this.logger = new Logger("ConnextInternal", opts.logLevel);
    this.network = opts.network;
    this.store = opts.store;

    // establish listeners
    this.listener = new ConnextListener(opts.channelRouter, this);

    // instantiate controllers with logger and cf
    this.depositController = new DepositController("DepositController", this);
    this.transferController = new TransferController("TransferController", this);
    this.swapController = new SwapController("SwapController", this);
    this.withdrawalController = new WithdrawalController("WithdrawalController", this);
    this.resolveConditionController = new ResolveConditionController(
      "ResolveConditionController",
      this,
    );
    this.conditionalTransferController = new ConditionalTransferController(
      "ConditionalTransferController",
      this,
    );
  }

  // register subscriptions
  public registerSubscriptions = async (): Promise<void> => {
    await this.listener.register();
  };

  ///////////////////////////////////
  // CORE CHANNEL METHODS

  public deposit = async (params: DepositParameters): Promise<ChannelState> => {
    return await this.depositController.deposit(params);
  };

  public swap = async (params: SwapParameters): Promise<CFCoreChannel> => {
    return await this.swapController.swap(params);
  };

  public transfer = async (params: TransferParameters): Promise<CFCoreChannel> => {
    return await this.transferController.transfer(params);
  };

  public withdraw = async (params: WithdrawParameters): Promise<ChannelState> => {
    return await this.withdrawalController.withdraw(params);
  };

  public resolveCondition = async (
    params: ResolveConditionParameters,
  ): Promise<ResolveConditionResponse> => {
    return await this.resolveConditionController.resolve(params);
  };

  public conditionalTransfer = async (
    params: ConditionalTransferParameters,
  ): Promise<ConditionalTransferResponse> => {
    return await this.conditionalTransferController.conditionalTransfer(params);
  };

  public getLatestNodeSubmittedWithdrawal = async (): Promise<
    { retry: number; tx: CFCoreTypes.MinimalTransaction } | undefined
  > => {
    const value = await this.channelRouter.get(withdrawalKey(this.publicIdentifier));

    if (!value) {
      return undefined;
    }

    const noRetry = value.retry === undefined || value.retry === null;
    if (!value.tx || noRetry) {
      const msg = `Can not find tx or retry in store under key ${withdrawalKey(
        this.publicIdentifier,
      )}`;
      this.logger.error(msg);
      throw new Error(msg);
    }
    return value;
  };

  public watchForUserWithdrawal = async (): Promise<void> => {
    // poll for withdrawal tx submitted to multisig matching tx data
    const maxBlocks = 15;
    const startingBlock = await this.ethProvider.getBlockNumber();

    // TODO: poller should not be completely blocking, but safe to leave for now
    // because the channel should be blocked
    try {
      await new Promise((resolve, reject) => {
        this.ethProvider.on("block", async (blockNumber: number) => {
          const found = await this.checkForUserWithdrawal(blockNumber);
          if (found) {
            await this.channelRouter.set([
              { path: withdrawalKey(this.publicIdentifier), value: undefined },
            ]);
            this.ethProvider.removeAllListeners("block");
            resolve();
          }
          if (blockNumber - startingBlock >= maxBlocks) {
            this.ethProvider.removeAllListeners("block");
            reject(
              `More than ${maxBlocks} have passed, blocks elapsed: ${blockNumber - startingBlock}`,
            );
          }
        });
      });
    } catch (e) {
      if (e.includes(`More than ${maxBlocks} have passed`)) {
        this.logger.debug(`Retrying node submission`);
        await this.retryNodeSubmittedWithdrawal();
      }
    }
  };

  public restoreStateFromBackup = async (xpub: string): Promise<void> => {
    if (this.routerType === RpcType.ChannelProvider) {
      throw new Error(`Cannot restore state with channel provider`);
    }
    const restoreStates = await this.channelRouter.restore();
    const multisigAddress = await this.getMultisigAddressfromXpub(xpub);
    const relevantPair = restoreStates.find(
      (p: { path: string; value: any }) => p.path === `store/${xpub}/channel/${multisigAddress}`,
    );
    if (!relevantPair) {
      throw new Error(
        `No matching remote states found for "store/${xpub}/channel/${multisigAddress}."`,
      );
    }

    this.logger.info(`Found state to restore from backup: ${JSON.stringify(relevantPair)}`);
    await this.channelRouter.set([relevantPair], false);
  };

  public restoreStateFromNode = async (xpub: string): Promise<void> => {
    const states = await this.node.restoreStates(xpub);
    this.logger.info(`Found states to restore: ${JSON.stringify(states)}`);

    // TODO: this should prob not be hardcoded like this
    const actualStates = states.map((state: { path: string; value: object }) => {
      return {
        path: state.path
          .replace(this.nodePublicIdentifier, xpub)
          .replace(ConnextNodeStorePrefix, "store"),
        value: state.value[state.path],
      };
    });
    await this.channelRouter.set(actualStates, false);
  };

  public restoreState = async (mnemonic: string): Promise<ConnextInternal> => {
    if (this.routerType === RpcType.ChannelProvider) {
      throw new Error(`Cannot restore state with channel provider`);
    }
    const hdNode = fromMnemonic(mnemonic);
    const xpriv = hdNode.extendedKey;
    const xpub = hdNode.derivePath("m/44'/60'/0'/25446").neuter().extendedKey;

    // always set the mnemonic in the store
    this.channelRouter.reset();
    await this.channelRouter.set([{ path: EXTENDED_PRIVATE_KEY_PATH, value: xpriv }], false);

    // try to recover the rest of the stateS
    try {
      await this.restoreStateFromBackup(xpub);
    } catch (e) {
      await this.restoreStateFromNode(xpub);
    }

    // recreate client with new mnemonic
    const client = await connect({ ...this.opts, mnemonic });
    return client;
  };

  public getMultisigAddressfromXpub = async (xpub: string): Promise<string> => {
    const owners: string[] = [xpub, this.nodePublicIdentifier];
    const proxyFactoryAddress: string = this.opts.config.contractAddresses.ProxyFactory;
    const minimumViableMultisigAddress: string = this.opts.config.contractAddresses
      .MinimumViableMultisig;
    return getAddress(
      solidityKeccak256(
        ["bytes1", "address", "uint256", "bytes32"],
        [
          "0xff",
          proxyFactoryAddress,
          solidityKeccak256(
            ["bytes32", "uint256"],
            [
              keccak256(
                new Interface(MinimumViableMultisig.abi).functions.setup.encode([
                  xkeysToSortedKthAddresses(owners, 0),
                ]),
              ),
              0,
            ],
          ),
          solidityKeccak256(
            ["bytes", "uint256"],
            [`0x${Proxy.evm.bytecode.object}`, minimumViableMultisigAddress],
          ),
        ],
      ).slice(-40),
    );
  };

  ///////////////////////////////////
  // EVENT METHODS

  public on = (
    event: ConnextEvent | CFCoreTypes.EventName,
    callback: (...args: any[]) => void,
  ): ConnextListener => {
    return this.listener.on(event, callback);
  };

  public emit = (event: ConnextEvent | CFCoreTypes.EventName, data: any): boolean => {
    return this.listener.emit(event, data);
  };

  ///////////////////////////////////
  // PROVIDER/ROUTER METHODS
  public getState = async (): Promise<CFCoreTypes.GetStateResult> => {
    return await this.channelRouter.getState(this.multisigAddress);
  };

  public providerDeposit = async (
    amount: BigNumber,
    assetId: string,
    notifyCounterparty: boolean = false,
  ): Promise<CFCoreTypes.DepositResult> => {
    const depositAddr = publicIdentifierToAddress(this.publicIdentifier);
    let bal: BigNumber;

    if (assetId === AddressZero) {
      bal = await this.ethProvider.getBalance(depositAddr);
    } else {
      // get token balance
      const token = new Contract(assetId, tokenAbi, this.ethProvider);
      // TODO: correct? how can i use allowance?
      bal = await token.balanceOf(depositAddr);
    }

    const err = [
      notPositive(amount),
      invalidAddress(assetId),
      notLessThanOrEqualTo(amount, bal), // cant deposit more than default addr owns
    ].filter(falsy)[0];
    if (err) {
      this.logger.error(err);
      throw new Error(err);
    }

    return await this.channelRouter.deposit(
      amount,
      assetId,
      this.multisigAddress,
      notifyCounterparty,
    );
  };

  // TODO: under what conditions will this fail?
  public getAppInstances = async (): Promise<AppInstanceJson[]> => {
    // TODO
    return (await this.channelRouter.getAppInstances()).appInstances;
  };

  // TODO: under what conditions will this fail?
  public getFreeBalance = async (
    assetId: string = AddressZero,
  ): Promise<CFCoreTypes.GetFreeBalanceStateResult> => {
    if (typeof assetId !== "string") {
      throw new Error(`Asset id must be a string: ${JSON.stringify(assetId, null, 2)}`);
    }
    const normalizedAssetId = makeChecksum(assetId);
    try {
      return await this.channelRouter.getFreeBalance(assetId, this.multisigAddress);
    } catch (e) {
      const error = `No free balance exists for the specified token: ${normalizedAssetId}`;
      if (e.message.includes(error)) {
        // if there is no balance, return undefined
        // NOTE: can return free balance obj with 0s,
        // but need the nodes free balance
        // address in the multisig
        const obj = {};
        obj[freeBalanceAddressFromXpub(this.nodePublicIdentifier)] = new BigNumber(0);
        obj[this.freeBalanceAddress] = new BigNumber(0);
        return obj;
      }
      throw e;
    }
  };

  public getProposedAppInstances = async (): Promise<
    CFCoreTypes.GetProposedAppInstancesResult | undefined
  > => {
    return await this.channelRouter.getProposedAppInstances();
  };

  public getProposedAppInstance = async (
    appInstanceId: string,
  ): Promise<CFCoreTypes.GetProposedAppInstanceResult | undefined> => {
    return await this.channelRouter.getProposedAppInstance(appInstanceId);
  };

  public getAppInstanceDetails = async (
    appInstanceId: string,
  ): Promise<CFCoreTypes.GetAppInstanceDetailsResult | undefined> => {
    const err = await this.appNotInstalled(appInstanceId);
    if (err) {
      this.logger.warn(err);
      return undefined;
    }
    return await this.channelRouter.getAppInstanceDetails(appInstanceId);
  };

  public getAppState = async (
    appInstanceId: string,
  ): Promise<CFCoreTypes.GetStateResult | undefined> => {
    // check the app is actually installed, or returned undefined
    const err = await this.appNotInstalled(appInstanceId);
    if (err) {
      this.logger.warn(err);
      return undefined;
    }
    return await this.channelRouter.getAppState(appInstanceId);
  };

  public takeAction = async (
    appInstanceId: string,
    action: AppActionBigNumber,
  ): Promise<CFCoreTypes.TakeActionResult> => {
    // check the app is actually installed
    const err = await this.appNotInstalled(appInstanceId);
    if (err) {
      this.logger.error(err);
      throw new Error(err);
    }
    // check state is not finalized
    const state: CFCoreTypes.GetStateResult = await this.getAppState(appInstanceId);
    // FIXME: casting?
    if ((state.state as any).finalized) {
      throw new Error("Cannot take action on an app with a finalized state.");
    }
    return await this.channelRouter.takeAction(appInstanceId, action);
  };

  public updateState = async (
    appInstanceId: string,
    newState: AppStateBigNumber | any, // cast to any bc no supported apps use
    // the update state method
  ): Promise<CFCoreTypes.UpdateStateResult> => {
    // check the app is actually installed
    const err = await this.appNotInstalled(appInstanceId);
    if (err) {
      this.logger.error(err);
      throw new Error(err);
    }
    // check state is not finalized
    const state: CFCoreTypes.GetStateResult = await this.getAppState(appInstanceId);
    // FIXME: casting?
    if ((state.state as any).finalized) {
      throw new Error("Cannot take action on an app with a finalized state.");
    }
    return await this.channelRouter.updateState(appInstanceId, newState);
  };

  public proposeInstallVirtualApp = async (
    params: CFCoreTypes.ProposeInstallVirtualParams,
  ): Promise<CFCoreTypes.ProposeInstallVirtualResult> => {
    if (params.intermediaryIdentifier !== this.nodePublicIdentifier) {
      throw new Error(`Cannot install virtual app without node as intermediary`);
    }
    return await this.channelRouter.proposeInstallVirtualApp(params);
  };

  public proposeInstallApp = async (
    params: CFCoreTypes.ProposeInstallParams,
  ): Promise<CFCoreTypes.ProposeInstallResult> => {
    return await this.channelRouter.proposeInstallApp(params);
  };

  public installVirtualApp = async (
    appInstanceId: string,
  ): Promise<CFCoreTypes.InstallVirtualResult> => {
    // check the app isnt actually installed
    const alreadyInstalled = await this.appInstalled(appInstanceId);
    if (alreadyInstalled) {
      throw new Error(alreadyInstalled);
    }
    return await this.channelRouter.installVirtualApp(appInstanceId, this.nodePublicIdentifier);
  };

  public installApp = async (appInstanceId: string): Promise<CFCoreTypes.InstallResult> => {
    // check the app isnt actually installed
    const alreadyInstalled = await this.appInstalled(appInstanceId);
    if (alreadyInstalled) {
      throw new Error(alreadyInstalled);
    }
    return await this.channelRouter.installApp(appInstanceId);
  };

  public uninstallApp = async (appInstanceId: string): Promise<CFCoreTypes.UninstallResult> => {
    // check the app is actually installed
    const err = await this.appNotInstalled(appInstanceId);
    if (err) {
      this.logger.error(err);
      throw new Error(err);
    }
    return await this.channelRouter.uninstallApp(appInstanceId);
  };

  public uninstallVirtualApp = async (
    appInstanceId: string,
  ): Promise<CFCoreTypes.UninstallVirtualResult> => {
    // check the app is actually installed
    const err = await this.appNotInstalled(appInstanceId);
    if (err) {
      this.logger.error(err);
      throw new Error(err);
    }

    return await this.channelRouter.uninstallVirtualApp(appInstanceId, this.nodePublicIdentifier);
  };

  public rejectInstallApp = async (appInstanceId: string): Promise<CFCoreTypes.UninstallResult> => {
    return await this.channelRouter.rejectInstallApp(appInstanceId);
  };

  public providerWithdraw = async (
    assetId: string,
    amount: BigNumber,
    recipient?: string,
  ): Promise<CFCoreTypes.WithdrawResult> => {
    const freeBalance = await this.getFreeBalance(assetId);
    const preWithdrawalBal = freeBalance[this.freeBalanceAddress];
    const err = [
      notLessThanOrEqualTo(amount, preWithdrawalBal),
      assetId ? invalidAddress(assetId) : null,
      recipient ? invalidAddress(recipient) : null,
    ].filter(falsy)[0];
    if (err) {
      this.logger.error(err);
      throw new Error(err);
    }

    return await this.channelRouter.withdraw(amount, this.multisigAddress, assetId, recipient);
  };

  // TODO Add to ChannelRouter
  public cfWithdrawCommitment = async (
    amount: BigNumber,
    assetId?: string,
    recipient?: string,
  ): Promise<CFCoreTypes.WithdrawCommitmentResult> => {
    const freeBalance = await this.getFreeBalance(assetId);
    const preWithdrawalBal = freeBalance[this.freeBalanceAddress];
    const err = [
      notLessThanOrEqualTo(amount, preWithdrawalBal),
      assetId ? invalidAddress(assetId) : null,
      recipient ? invalidAddress(recipient) : null,
    ].filter(falsy)[0];
    if (err) {
      this.logger.error(err);
      throw new Error(err);
    }
    return await this.channelRouter.withdrawCommitment(
      amount,
      makeChecksumOrEthAddress(assetId),
      recipient,
    );
  };

  ///////////////////////////////////
  // NODE METHODS

  public verifyAppSequenceNumber = async (): Promise<any> => {
    const { data: sc } = await this.channelRouter.getStateChannel();
    let appSequenceNumber: number;
    try {
      appSequenceNumber = (await sc.mostRecentlyInstalledAppInstance()).appSeqNo;
    } catch (e) {
      if (e.message.includes("There are no installed AppInstances in this StateChannel")) {
        appSequenceNumber = 0;
      } else {
        throw e;
      }
    }
    return await this.node.verifyAppSequenceNumber(appSequenceNumber);
  };

  public reclaimPendingAsyncTransfers = async (): Promise<void> => {
    const pendingTransfers = await this.node.getPendingAsyncTransfers();
    for (const transfer of pendingTransfers) {
      const { amount, assetId, encryptedPreImage, paymentId } = transfer;
      await this.reclaimPendingAsyncTransfer(paymentId, encryptedPreImage);
    }
  };

  public reclaimPendingAsyncTransfer = async (
    paymentId: string,
    encryptedPreImage: string,
  ): Promise<ResolveLinkedTransferResponse> => {
    this.logger.info(`Reclaiming transfer ${JSON.stringify({ paymentId, encryptedPreImage })}`);
    // decrypt secret and resolve
    const privateKey = fromMnemonic(this.opts.mnemonic).derivePath(CF_PATH).privateKey;
    const cipher = EthCrypto.cipher.parse(encryptedPreImage);

    const preImage = await EthCrypto.decryptWithPrivateKey(privateKey, cipher);
    this.logger.debug(`Decrypted message and recovered preImage: ${preImage}`);
    const response = await this.resolveCondition({
      conditionType: "LINKED_TRANSFER_TO_RECIPIENT",
      paymentId,
      preImage,
    });
    this.logger.info(`Reclaimed transfer ${JSON.stringify(response)}`);
    return response;
  };

  ///////////////////////////////////
  // LOW LEVEL METHODS

  public getRegisteredAppDetails = (appName: SupportedApplication): RegisteredAppDetails => {
    const appInfo = this.appRegistry.filter((app: RegisteredAppDetails) => {
      return app.name === appName && app.network === this.network.name;
    });

    if (!appInfo || appInfo.length === 0) {
      throw new Error(`Could not find ${appName} app details on ${this.network.name} network`);
    }

    if (appInfo.length > 1) {
      throw new Error(`Found multiple ${appName} app details on ${this.network.name} network`);
    }
    return appInfo[0];
  };

  public matchTx = (
    givenTransaction: Transaction,
    expected: CFCoreTypes.MinimalTransaction,
  ): boolean => {
    return (
      givenTransaction.to === expected.to &&
      bigNumberify(givenTransaction.value).eq(expected.value) &&
      givenTransaction.data === expected.data
    );
  };

  public resubmitActiveWithdrawal = async (): Promise<void> => {
    const withdrawal = await this.channelRouter.get(withdrawalKey(this.publicIdentifier));

    if (!withdrawal) {
      // no active withdrawal, nothing to do
      return;
    }

    if (withdrawal.retry >= MAX_WITHDRAWAL_RETRIES) {
      // throw an error here, node has failed to submit withdrawal.
      // this indicates the node is compromised or acting maliciously.
      // no further actions should be taken by the client. (since this fn is
      // called on `connext.connect`, throwing an error will prevent client
      // starting properly)
      const msg = `Cannot connect client, hub failed to submit latest withdrawal ${MAX_WITHDRAWAL_RETRIES} times.`;
      this.logger.error(msg);
      throw new Error(msg);
    }

    // get latest submitted withdrawal from hub and check to see if the
    // data matches what we expect from our store
    const tx = await this.node.getLatestWithdrawal();
    if (this.matchTx(tx, withdrawal.tx)) {
      // the withdrawal in our store matches latest submitted tx,
      // clear value in store and return
      await this.channelRouter.set([
        {
          path: withdrawalKey(this.publicIdentifier),
          value: undefined,
        },
      ]);
      return;
    }

    // otherwise, there are retries remaining, and you should resubmit
    this.logger.debug(
      `Found active withdrawal with ${withdrawal.retry} retries, waiting for withdrawal to be caught`,
    );
    await this.retryNodeSubmittedWithdrawal();
  };

  public retryNodeSubmittedWithdrawal = async (): Promise<void> => {
    const val = await this.getLatestNodeSubmittedWithdrawal();
    if (!val) {
      this.logger.error(`No transaction found to retry`);
      return;
    }
    let { retry, tx } = val;
    retry += 1;
    await this.channelRouter.set([
      {
        path: withdrawalKey(this.publicIdentifier),
        value: { tx, retry },
      },
    ]);
    if (retry >= MAX_WITHDRAWAL_RETRIES) {
      const msg = `Tried to have node submit withdrawal ${MAX_WITHDRAWAL_RETRIES} times and it did not work, try submitting from wallet.`;
      this.logger.error(msg);
      // TODO: make this submit from wallet :)
      // but this is weird, could take a while and may have gas issues.
      // may not be the best way to do this
      throw new Error(msg);
    }
    await this.node.withdraw(tx);
    await this.watchForUserWithdrawal();
  };

  private appNotInstalled = async (appInstanceId: string): Promise<string | undefined> => {
    const apps = await this.getAppInstances();
    const app = apps.filter((app: AppInstanceJson) => app.identityHash === appInstanceId);
    if (!app || app.length === 0) {
      return (
        `Could not find installed app with id: ${appInstanceId}. ` +
        `Installed apps: ${JSON.stringify(apps, replaceBN, 2)}.`
      );
    }
    if (app.length > 1) {
      return (
        `CRITICAL ERROR: found multiple apps with the same id. ` +
        `Installed apps: ${JSON.stringify(apps, replaceBN, 2)}.`
      );
    }
    return undefined;
  };

  private appInstalled = async (appInstanceId: string): Promise<string | undefined> => {
    const apps = await this.getAppInstances();
    const app = apps.filter((app: AppInstanceJson) => app.identityHash === appInstanceId);
    if (app.length > 0) {
      return (
        `App with id ${appInstanceId} is already installed. ` +
        `Installed apps: ${JSON.stringify(apps, replaceBN, 2)}.`
      );
    }
    return undefined;
  };

  private checkForUserWithdrawal = async (inBlock: number): Promise<boolean> => {
    const val = await this.getLatestNodeSubmittedWithdrawal();
    if (!val) {
      this.logger.error(`No transaction found in store.`);
      return false;
    }

    const { tx } = val;
    // get the transaction hash that we should be looking for from
    // the contract method
    const txsTo = await this.ethProvider.getTransactionCount(tx.to, inBlock);
    if (txsTo === 0) {
      return false;
    }

    const block = await this.ethProvider.getBlock(inBlock);
    const { transactions } = block;
    if (transactions.length === 0) {
      return false;
    }

    for (const transactionHash of transactions) {
      const transaction = await this.ethProvider.getTransaction(transactionHash);
      if (this.matchTx(transaction, tx)) {
        return true;
      }
    }
    return false;
  };
}
