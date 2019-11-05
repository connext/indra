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
  ClientOptions,
  ConditionalTransferParameters,
  ConditionalTransferResponse,
  ConnextClientI,
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
  Store,
  SupportedApplication,
  SupportedNetwork,
  SwapParameters,
  Transfer,
  TransferParameters,
  WithdrawParameters,
} from "@connext/types";
import { Address, AppInstanceJson, Node as CFCoreTypes } from "@counterfactual/types";
import "core-js/stable";
import EthCrypto from "eth-crypto";
import { Contract, providers, Wallet } from "ethers";
import { AddressZero } from "ethers/constants";
import { BigNumber, bigNumberify, Network, Transaction } from "ethers/utils";
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
  getMultisigAddressfromXpubs,
  publicIdentifierToAddress,
  replaceBN,
  withdrawalKey,
} from "./lib/utils";
import { ConnextListener } from "./listener";
import { NodeApiClient } from "./node";
import { InternalClientOptions } from "./types";
import { invalidAddress } from "./validation/addresses";
import { falsy, notLessThanOrEqualTo, notPositive } from "./validation/bn";

const MAX_WITHDRAWAL_RETRIES = 3;

export const connect = async (opts: ClientOptions): Promise<ConnextClientI> => {
  const { logLevel, ethProviderUrl, mnemonic, nodeUrl, store, channelProvider } = opts;
  const log = new Logger("ConnextConnect", logLevel);

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

  // set channel provider config
  let channelProviderConfig: ChannelProviderConfig;
  if (channelProvider) {
    // enable the channel provider, which sets the config property
    await channelProvider.enable();
    channelProviderConfig = {
      ...channelProvider.config,
      type: RpcType.ChannelProvider,
    };
  } else if (mnemonic) {
    // generate extended private key from mnemonic
    const hdNode = fromMnemonic(mnemonic);
    const xpriv = hdNode.extendedKey;
    const xpub = hdNode.derivePath(CF_PATH).neuter().extendedKey;
    await store.set([{ path: EXTENDED_PRIVATE_KEY_PATH, value: xpriv }]);
    channelProviderConfig = {
      freeBalanceAddress: freeBalanceAddressFromXpub(xpub),
      nodeUrl,
      signerAddress: hdNode.derivePath(CF_PATH).address,
      type: RpcType.CounterfactualNode,
      userPublicIdentifier: xpub,
    } as any;
  } else {
    throw new Error(`Must provide a channel provider or mnemonic on startup.`);
  }

  log.debug(`Using channel provider config: ${JSON.stringify(channelProviderConfig, null, 2)}`);

  log.debug(`Creating messaging service client (logLevel: ${logLevel})`);
  const messagingFactory = new MessagingServiceFactory({
    logLevel,
    messagingUrl: channelProviderConfig.nodeUrl,
  });
  const messaging = messagingFactory.createService("messaging");
  await messaging.connect();

  // create a new node api instance
  const node: NodeApiClient = new NodeApiClient({ logLevel, messaging });
  const config = await node.config();
  log.debug(`Node provided config: ${JSON.stringify(config, null, 2)}`);

  let channelRouter: ChannelRouter;
  switch (channelProviderConfig.type) {
    case RpcType.ChannelProvider:
      channelRouter = new ChannelRouter(channelProvider!, channelProviderConfig);
      break;
    case RpcType.CounterfactualNode:
      const cfCore = await CFCore.create(
        messaging as any, // TODO: FIX
        store,
        { STORE_KEY_PREFIX: "store" },
        ethProvider,
        config.contractAddresses,
        { acquireLock: node.acquireLock.bind(node) },
      );
      const wallet = Wallet.fromMnemonic(opts.mnemonic!, CF_PATH);
      channelRouter = new ChannelRouter(cfCore, channelProviderConfig, store, wallet);
      break;
    default:
      throw new Error(`Unrecognized channel provider type: ${channelProviderConfig.type}`);
  }

  // set pubids + channel router
  node.channelRouter = channelRouter;
  node.userPublicIdentifier = channelProviderConfig.userPublicIdentifier;
  node.nodePublicIdentifier = config.nodePublicIdentifier;

  const myChannel = await node.getChannel();
  let multisigAddress: string;
  if (!myChannel) {
    log.debug("no channel detected, creating channel..");
    const creationEventData: CFCoreTypes.CreateChannelResult = await new Promise(
      async (res: any, rej: any): Promise<any> => {
        const timer = setTimeout(
          (): void => rej("Create channel event not fired within 30s"),
          30000,
        );
        channelRouter.once(
          CFCoreTypes.EventName.CREATE_CHANNEL,
          (data: CreateChannelMessage): void => {
            clearTimeout(timer);
            res(data.data);
          },
        );

        const creationData = await node.createChannel();
        log.debug(`created channel, transaction: ${JSON.stringify(creationData)}`);
      },
    );
    multisigAddress = creationEventData.multisigAddress;
  } else {
    multisigAddress = myChannel.multisigAddress;
  }
  log.debug(`multisigAddress: ${multisigAddress}`);

  channelRouter.multisigAddress = multisigAddress;

  // create the new client
  const client = new ConnextClient({
    appRegistry: await node.appRegistry(),
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

  log.debug("Registering subscriptions");
  await client.registerSubscriptions();

  log.debug("Reclaiming pending async transfers");
  await client.reclaimPendingAsyncTransfers();

  // make sure there is not an active withdrawal with >= MAX_WITHDRAWAL_RETRIES
  log.debug("Resubmitting active withdrawals");
  await client.resubmitActiveWithdrawal();

  log.debug("Done creating channel client");
  return client;
};

export class ConnextClient implements ConnextClientI {
  public appRegistry: AppRegistry;
  public channelRouter: ChannelRouter;
  public config: GetConfigResponse;
  public ethProvider: providers.JsonRpcProvider;
  public freeBalanceAddress: string;
  public isAvailable: Promise<void>;
  public listener: ConnextListener;
  public log: Logger;
  public messaging: IMessagingService;
  public multisigAddress: Address;
  public network: Network;
  public node: NodeApiClient;
  public nodePublicIdentifier: string;
  public publicIdentifier: string;
  public routerType: RpcType;
  public signerAddress: Address;
  public store: Store;

  private opts: InternalClientOptions;

  private depositController: DepositController;
  private transferController: TransferController;
  private swapController: SwapController;
  private withdrawalController: WithdrawalController;
  private conditionalTransferController: ConditionalTransferController;
  private resolveConditionController: ResolveConditionController;

  constructor(opts: InternalClientOptions) {
    this.opts = opts;
    this.appRegistry = opts.appRegistry;
    this.channelRouter = opts.channelRouter;
    this.config = opts.config;
    this.ethProvider = opts.ethProvider;
    this.messaging = opts.messaging;
    this.network = opts.network;
    this.network = opts.network;
    this.node = opts.node;
    this.store = opts.store;

    this.freeBalanceAddress = this.channelRouter.config.freeBalanceAddress;
    this.signerAddress = this.channelRouter.config.signerAddress;
    this.routerType = this.channelRouter.config.type;
    this.publicIdentifier = this.channelRouter.config.userPublicIdentifier;
    this.multisigAddress = this.opts.multisigAddress;
    this.nodePublicIdentifier = this.opts.config.nodePublicIdentifier;
    this.log = new Logger("ConnextClient", opts.logLevel);

    // establish listeners
    this.listener = new ConnextListener(opts.channelRouter, this);

    // instantiate controllers with log and cf
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

    this.isAvailable = new Promise(
      async (resolve: any, reject: any): Promise<any> => {
        // Wait for channel to be available
        const channelIsAvailable = async (): Promise<boolean> => {
          const chan = await this.node.getChannel();
          return chan && chan.available;
        };
        while (!(await channelIsAvailable())) {
          await new Promise((res: any): any => setTimeout((): void => res(), 100));
        }
        resolve();
      },
    );
  }

  // register subscriptions
  public registerSubscriptions = async (): Promise<void> => {
    await this.listener.register();
  };

  ///////////////////////////////////
  // Unsorted methods pulled from the old abstract wrapper class

  public restart = async (): Promise<void> => {
    // Create a fresh channelRouter & start using that.
    // End goal is to use this to restart the cfNode after restoring state
    let channelRouter: ChannelRouter;
    switch (this.routerType) {
      case RpcType.ChannelProvider:
        channelRouter = new ChannelRouter(this.opts.channelProvider!, this.channelRouter.config);
        break;
      case RpcType.CounterfactualNode:
        const cfCore = await CFCore.create(
          this.messaging as any, // TODO: FIX
          this.store,
          { STORE_KEY_PREFIX: "store" },
          this.ethProvider,
          this.config.contractAddresses,
          { acquireLock: this.node.acquireLock.bind(this.node) },
        );
        const wallet = Wallet.fromMnemonic(this.opts.mnemonic!, CF_PATH);
        channelRouter = new ChannelRouter(cfCore, this.channelRouter.config, this.store, wallet);
        break;
      default:
        throw new Error(`Unrecognized channel provider type: ${this.routerType}`);
    }
    this.node.channelRouter = channelRouter;
    this.channelRouter = channelRouter;
  };

  public getChannel = async (): Promise<GetChannelResponse> => {
    return await this.node.getChannel();
  };

  public requestCollateral = async (tokenAddress: string): Promise<void> => {
    return await this.node.requestCollateral(tokenAddress);
  };

  public setRecipientAndEncryptedPreImageForLinkedTransfer = async (
    recipient: string,
    encryptedPreImage: string,
    linkedHash: string,
  ): Promise<any> => {
    return await this.node.setRecipientAndEncryptedPreImageForLinkedTransfer(
      recipient,
      encryptedPreImage,
      linkedHash,
    );
  };

  public channelProviderConfig = async (): Promise<ChannelProviderConfig> => {
    return this.channelRouter.config;
  };

  public getLinkedTransfer = async (paymentId: string): Promise<any> => {
    return await this.node.fetchLinkedTransfer(paymentId);
  };

  public getAppRegistry = async (appDetails?: {
    name: SupportedApplication;
    network: SupportedNetwork;
  }): Promise<AppRegistry> => {
    return await this.node.appRegistry(appDetails);
  };

  public createChannel = async (): Promise<CreateChannelResponse> => {
    return await this.node.createChannel();
  };

  public subscribeToSwapRates = async (from: string, to: string, callback: any): Promise<any> => {
    return await this.node.subscribeToSwapRates(from, to, callback);
  };

  public getLatestSwapRate = async (from: string, to: string): Promise<string> => {
    return await this.node.getLatestSwapRate(from, to);
  };

  public unsubscribeToSwapRates = async (from: string, to: string): Promise<void> => {
    return await this.node.unsubscribeFromSwapRates(from, to);
  };

  public addPaymentProfile = async (profile: PaymentProfile): Promise<PaymentProfile> => {
    return await this.node.addPaymentProfile(profile);
  };

  public getPaymentProfile = async (assetId?: string): Promise<PaymentProfile | undefined> => {
    return await this.node.getPaymentProfile(assetId);
  };

  public getTransferHistory = async (): Promise<Transfer[]> => {
    return await this.node.getTransferHistory();
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

    if (!value || value === "undefined") {
      return undefined;
    }

    const noRetry = value.retry === undefined || value.retry === null;
    if (!value.tx || noRetry) {
      const msg = `Can not find tx or retry in store under key ${withdrawalKey(
        this.publicIdentifier,
      )}`;
      this.log.error(msg);
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
      await new Promise((resolve: any, reject: any): any => {
        this.ethProvider.on(
          "block",
          async (blockNumber: number): Promise<void> => {
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
              reject(`More than ${maxBlocks} have passed: ${blockNumber - startingBlock}`);
            }
          },
        );
      });
    } catch (e) {
      if (e.includes(`More than ${maxBlocks} have passed`)) {
        this.log.debug(`Retrying node submission`);
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
      (p: { path: string; value: any }): boolean =>
        p.path === `store/${xpub}/channel/${multisigAddress}`,
    );
    if (!relevantPair) {
      throw new Error(
        `No matching remote states found for "store/${xpub}/channel/${multisigAddress}."`,
      );
    }

    this.log.info(`Found state to restore from backup: ${JSON.stringify(relevantPair, null, 2)}`);
    await this.channelRouter.set([relevantPair], false);
  };

  public restoreStateFromNode = async (xpub: string): Promise<void> => {
    const states = await this.node.restoreStates(xpub);
    this.log.info(`Found states to restore: ${JSON.stringify(states)}`);

    // TODO: this should prob not be hardcoded like this
    const actualStates = states.map((state: { path: string; value: object }): any => {
      return {
        path: `store${state.path
          .replace(this.nodePublicIdentifier, xpub)
          .substring(state.path.indexOf("/"))}`,
        value: state.value[state.path],
      };
    });
    if (this.store) {
      await this.store.set(actualStates, false);
    }
  };

  public restoreState = async (mnemonic: string): Promise<void> => {
    if (this.routerType === RpcType.ChannelProvider) {
      throw new Error(`Cannot restore state with channel provider`);
    }
    const hdNode = fromMnemonic(mnemonic);
    const xpriv = hdNode.extendedKey;
    const xpub = hdNode.derivePath("m/44'/60'/0'/25446").neuter().extendedKey;

    // always set the mnemonic in the store
    this.channelRouter.reset();
    if (this.store) {
      await this.store.set([{ path: EXTENDED_PRIVATE_KEY_PATH, value: xpriv }], false);
    }

    // try to recover the rest of the stateS
    try {
      await this.restoreStateFromBackup(xpub);
      this.log.debug(`restored state from backup!`);
    } catch (e) {
      await this.restoreStateFromNode(xpub);
      this.log.debug(`restored state from node!`);
    }

    // recreate client with new mnemonic
    const client = await connect({ ...this.opts, mnemonic });
  };

  public getMultisigAddressfromXpub = async (xpub: string): Promise<string> => {
    const owners: string[] = [xpub, this.nodePublicIdentifier];
    const proxyFactoryAddress: string = this.opts.config.contractAddresses.ProxyFactory;
    const minimumViableMultisigAddress: string = this.opts.config.contractAddresses
      .MinimumViableMultisig;
    return getMultisigAddressfromXpubs(owners, proxyFactoryAddress, minimumViableMultisigAddress);
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
      this.log.error(err);
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
      this.log.warn(err);
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
      this.log.warn(err);
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
      this.log.error(err);
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
      this.log.error(err);
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
      this.log.error(err);
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
      this.log.error(err);
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
      this.log.error(err);
      throw new Error(err);
    }

    return await this.channelRouter.withdraw(amount, this.multisigAddress, assetId, recipient);
  };

  public withdrawCommitment = async (
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
      this.log.error(err);
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
    this.log.info(`Reclaiming transfer ${JSON.stringify({ paymentId, encryptedPreImage })}`);
    // decrypt secret and resolve
    const privateKey = fromMnemonic(this.opts.mnemonic).derivePath(CF_PATH).privateKey;
    const cipher = EthCrypto.cipher.parse(encryptedPreImage);

    const preImage = await EthCrypto.decryptWithPrivateKey(privateKey, cipher);
    this.log.debug(`Decrypted message and recovered preImage: ${preImage}`);
    const response = await this.resolveCondition({
      conditionType: "LINKED_TRANSFER_TO_RECIPIENT",
      paymentId,
      preImage,
    });
    this.log.info(`Reclaimed transfer ${JSON.stringify(response)}`);
    return response;
  };

  ///////////////////////////////////
  // LOW LEVEL METHODS

  public getRegisteredAppDetails = (appName: SupportedApplication): RegisteredAppDetails => {
    const appInfo = this.appRegistry.filter((app: RegisteredAppDetails): boolean => {
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

    if (!withdrawal || withdrawal === "undefined") {
      // No active withdrawal, nothing to do
      return;
    }

    if (withdrawal.retry >= MAX_WITHDRAWAL_RETRIES) {
      // throw an error here, node has failed to submit withdrawal.
      // this indicates the node is compromised or acting maliciously.
      // no further actions should be taken by the client. (since this fn is
      // called on `connext.connect`, throwing an error will prevent client
      // starting properly)
      const msg = `Cannot connect client, hub failed to submit latest withdrawal ${MAX_WITHDRAWAL_RETRIES} times.`;
      this.log.error(msg);
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
    this.log.debug(
      `Found active withdrawal with ${withdrawal.retry} retries, waiting for withdrawal to be caught`,
    );
    await this.retryNodeSubmittedWithdrawal();
  };

  public retryNodeSubmittedWithdrawal = async (): Promise<void> => {
    const val = await this.getLatestNodeSubmittedWithdrawal();
    if (!val) {
      this.log.error(`No transaction found to retry`);
      return;
    }
    let { retry } = val;
    const { tx } = val;
    retry += 1;
    await this.channelRouter.set([
      {
        path: withdrawalKey(this.publicIdentifier),
        value: { tx, retry },
      },
    ]);
    if (retry >= MAX_WITHDRAWAL_RETRIES) {
      const msg = `Tried to have node submit withdrawal ${MAX_WITHDRAWAL_RETRIES} times and it did not work, try submitting from wallet.`;
      this.log.error(msg);
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
    const app = apps.filter((app: AppInstanceJson): boolean => app.identityHash === appInstanceId);
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
    const app = apps.filter((app: AppInstanceJson): boolean => app.identityHash === appInstanceId);
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
      this.log.error(`No transaction found in store.`);
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
