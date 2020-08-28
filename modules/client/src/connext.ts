import { ERC20 } from "@connext/contracts";
import {
  Address,
  AppAction,
  AppInstanceJson,
  AppRegistry,
  AssetId,
  ChannelMethods,
  ChannelProviderConfig,
  ConditionalTransferTypes,
  CONVENTION_FOR_ETH_ASSET_ID,
  DefaultApp,
  DepositAppName,
  DepositAppState,
  EventName,
  EventNames,
  EventPayload,
  FreeBalanceResponse,
  IChannelProvider,
  IChannelSigner,
  IConnextClient,
  ILoggerService,
  IMessagingService,
  INodeApiClient,
  IStoreService,
  MethodNames,
  MethodParams,
  MethodResults,
  NodeResponses,
  PublicParams,
  PublicResults,
  RebalanceProfile,
  SimpleLinkedTransferAppName,
  SimpleTwoPartySwapAppName,
  SupportedApplicationNames,
  WithdrawalMonitorObject,
  WithdrawAppName,
  IWatcher,
  StoredAppChallengeStatus,
} from "@connext/types";
import {
  delay,
  getRandomBytes32,
  getAddressFromAssetId,
  getSignerAddressFromPublicIdentifier,
  stringify,
  computeCancelDisputeHash,
} from "@connext/utils";
import { BigNumber, Contract, providers, constants, utils, BigNumberish } from "ethers";

import {
  DepositController,
  SwapController,
  WithdrawalController,
  CreateTransferController,
  ResolveTransferController,
} from "./controllers";
import { ConnextListener } from "./listener";
import { InternalClientOptions } from "./types";
import { NodeApiClient } from "./node";

const { AddressZero } = constants;
const { soliditySha256 } = utils;

export class ConnextClient implements IConnextClient {
  public appRegistry: AppRegistry;
  public channelProvider: IChannelProvider;
  public config: NodeResponses.GetConfig;
  public ethProvider: providers.JsonRpcProvider;
  public chainId: number;
  public listener: ConnextListener;
  public log: ILoggerService;
  public messaging: IMessagingService;
  public multisigAddress: Address;
  public network: providers.Network;
  public node: INodeApiClient;
  public nodeIdentifier: string;
  public nodeSignerAddress: string;
  public publicIdentifier: string;
  public signer: IChannelSigner;
  public signerAddress: string;
  public store: IStoreService;
  public token: Contract;
  public watcher: IWatcher;

  private opts: InternalClientOptions;

  private depositController: DepositController;
  private createTransferController: CreateTransferController;
  private resolveTransferController: ResolveTransferController;
  private swapController: SwapController;
  private withdrawalController: WithdrawalController;

  constructor(opts: InternalClientOptions) {
    this.opts = opts;
    this.appRegistry = opts.appRegistry;
    this.channelProvider = opts.channelProvider;
    this.config = opts.config;
    this.ethProvider = opts.ethProvider;
    this.chainId = opts.chainId;
    this.signer = opts.signer;
    this.log = opts.logger.newContext("ConnextClient");
    this.messaging = opts.messaging;
    this.network = opts.network;
    this.node = opts.node;
    this.store = opts.store;
    this.token = opts.token;
    this.watcher = opts.watcher;

    this.signerAddress = this.channelProvider.config.signerAddress;
    this.publicIdentifier = this.channelProvider.config.userIdentifier;
    this.multisigAddress = this.channelProvider.config.multisigAddress;
    this.nodeIdentifier = this.opts.config.nodeIdentifier;
    this.nodeSignerAddress = getSignerAddressFromPublicIdentifier(this.nodeIdentifier);

    // establish listeners
    this.listener = new ConnextListener(this);

    // instantiate controllers with log and cf
    this.depositController = new DepositController("DepositController", this);
    this.swapController = new SwapController("SwapController", this);
    this.withdrawalController = new WithdrawalController("WithdrawalController", this);
    this.createTransferController = new CreateTransferController("CreateTransferController", this);
    this.resolveTransferController = new ResolveTransferController(
      "ResolveTransferController",
      this,
    );
  }

  /**
   * Creates a promise that returns when the channel is available,
   * ie. when the setup protocol or create channel call is completed
   */
  public isAvailable = async (): Promise<void> => {
    return new Promise(
      async (resolve: any, reject: any): Promise<any> => {
        // Wait for channel to be available
        const channelIsAvailable = async (): Promise<boolean> => {
          const chan = await this.node.getChannel();
          return chan && chan.available;
        };
        while (!(await channelIsAvailable())) {
          await delay(100);
        }
        resolve();
      },
    );
  };

  // register subscriptions
  public registerSubscriptions = async (): Promise<void> => {
    await this.listener.register();
  };

  ///////////////////////////////////
  // Unsorted methods pulled from the old abstract wrapper class

  public restart = async (): Promise<void> => {
    if (!(await this.channelProvider.isSigner())) {
      this.log.warn("Cannot restart with an injected provider.");
      return;
    }

    // ensure that node and user address are different
    if (this.nodeIdentifier === this.publicIdentifier) {
      throw new Error(
        "Client must be instantiated with a secret that is different from the node's secret",
      );
    }

    // Create a fresh channelProvider & start using that.
    // End goal is to use this to restart the cfNode after restoring state
    await this.messaging.unsubscribe(`${this.publicIdentifier}*`);
    this.node = await NodeApiClient.init({
      messaging: this.messaging,
      messagingUrl: this.config.messagingUrl[0],
      signer: this.signer,
      nodeUrl: this.node.nodeUrl,
      ethProvider: this.ethProvider,
      logger: this.log,
      store: this.store,
      userIdentifier: this.publicIdentifier,
      chainId: this.chainId,
    });
    this.channelProvider = this.node.channelProvider;
    this.listener = new ConnextListener(this);
    await this.listener.register();
    await this.isAvailable();
  };

  public getChannel = async (): Promise<NodeResponses.GetChannel> => {
    return this.node.getChannel();
  };

  public requestCollateral = async (
    assetId: string,
    amount?: BigNumberish,
  ): Promise<PublicResults.RequestCollateral> => {
    const requestCollateralResponse = await this.node.requestCollateral(assetId, amount);
    if (!requestCollateralResponse) {
      return undefined;
    }
    const completed: Promise<FreeBalanceResponse> = new Promise(async (resolve, reject) => {
      try {
        await this.waitFor(
          EventNames.UNINSTALL_EVENT,
          120_000,
          (data) => data.appIdentityHash === requestCollateralResponse.depositAppIdentityHash,
        );
        const freeBalance = await this.getFreeBalance(assetId);
        resolve({ freeBalance });
      } catch (e) {
        reject(e);
      }
    });
    return { ...requestCollateralResponse, completed: () => completed };
  };

  public channelProviderConfig = async (): Promise<ChannelProviderConfig> => {
    return this.channelProvider.config;
  };

  public getLinkedTransfer = async (
    paymentId: string,
  ): Promise<NodeResponses.GetLinkedTransfer> => {
    return this.node.fetchLinkedTransfer(paymentId);
  };

  public getSignedTransfer = async (
    paymentId: string,
  ): Promise<NodeResponses.GetSignedTransfer> => {
    return this.node.fetchSignedTransfer(paymentId);
  };

  public getGraphTransfer = async (paymentId: string): Promise<NodeResponses.GetSignedTransfer> => {
    return this.node.fetchGraphTransfer(paymentId);
  };

  public getAppRegistry = async (
    appDetails?:
      | {
          name: SupportedApplicationNames;
          chainId: number;
        }
      | { appDefinitionAddress: string },
  ): Promise<AppRegistry | DefaultApp | undefined> => {
    if (!this.appRegistry) {
      this.appRegistry = await this.node.appRegistry();
    }
    const registry = this.appRegistry;
    if (!appDetails) {
      return registry;
    }
    const { name, chainId, appDefinitionAddress } = appDetails as any;
    if (name) {
      return registry.find((app) => app.name === name && app.chainId === chainId);
    }
    return registry.find((app) => app.appDefinitionAddress === appDefinitionAddress);
  };

  public createChannel = async (): Promise<NodeResponses.CreateChannel> => {
    return this.node.createChannel();
  };

  public subscribeToSwapRates = async (from: string, to: string, callback: any): Promise<any> => {
    return this.node.subscribeToSwapRates(from, to, callback);
  };

  public getLatestSwapRate = async (from: string, to: string): Promise<string> => {
    return this.node.getLatestSwapRate(from, to);
  };

  public unsubscribeToSwapRates = async (from: string, to: string): Promise<void> => {
    return this.node.unsubscribeFromSwapRates(from, to);
  };

  public getRebalanceProfile = async (assetId?: string): Promise<RebalanceProfile | undefined> => {
    return this.node.getRebalanceProfile(assetId);
  };

  public getTransferHistory = async (): Promise<NodeResponses.GetTransferHistory> => {
    return this.node.getTransferHistory();
  };

  ///////////////////////////////////
  // DISPUTE METHODS
  public initiateChallenge = (
    params: PublicParams.InitiateChallenge,
  ): Promise<PublicResults.InitiateChallenge> => {
    return this.watcher.initiate(params.appIdentityHash);
  };

  public cancelChallenge = async (
    params: PublicParams.CancelChallenge,
  ): Promise<PublicResults.CancelChallenge> => {
    const { appInstance } = (await this.getAppInstance(params.appIdentityHash)) || {};
    if (!appInstance) {
      throw new Error(`Could not find record of app with hash ${params.appIdentityHash}`);
    }
    const cancelHash = computeCancelDisputeHash(
      appInstance.identityHash,
      appInstance.latestVersionNumber,
    );
    const signature = await this.channelProvider.signMessage(cancelHash);
    return this.node.cancelChallenge(params.appIdentityHash, signature);
  };

  ///////////////////////////////////
  // CORE CHANNEL METHODS

  public deposit = async (params: PublicParams.Deposit): Promise<PublicResults.Deposit> => {
    await this.assertFreeBalanceNotDisputed();
    return this.depositController.deposit(params);
  };

  public requestDepositRights = async (
    params: PublicParams.RequestDepositRights,
  ): Promise<MethodResults.RequestDepositRights> => {
    await this.assertFreeBalanceNotDisputed();
    return this.depositController.requestDepositRights(params);
  };

  public rescindDepositRights = async (
    params: PublicParams.RescindDepositRights,
  ): Promise<PublicResults.RescindDepositRights> => {
    await this.assertFreeBalanceNotDisputed();
    return this.depositController.rescindDepositRights(params);
  };

  public checkDepositRights = async (
    params: PublicParams.CheckDepositRights,
  ): Promise<PublicResults.CheckDepositRights> => {
    const app = await this.depositController.getDepositApp(params);
    if (!app || app.initiatorIdentifier !== this.publicIdentifier) {
      return { appIdentityHash: undefined };
    }
    return { appIdentityHash: app.identityHash };
  };

  public swap = async (params: PublicParams.Swap): Promise<PublicResults.Swap> => {
    await this.assertFreeBalanceNotDisputed();
    return this.swapController.swap(params);
  };

  /**
   * Transfer currently uses the conditionalTransfer LinkedTransfer so that
   * async payments are the default transfer.
   */
  public transfer = async (
    params: PublicParams.Transfer,
  ): Promise<PublicResults.ConditionalTransfer> => {
    await this.assertFreeBalanceNotDisputed();
    return this.createTransferController.createTransfer({
      amount: params.amount,
      assetId: params.assetId || CONVENTION_FOR_ETH_ASSET_ID,
      conditionType: ConditionalTransferTypes.LinkedTransfer,
      meta: params.meta,
      paymentId: params.paymentId || getRandomBytes32(),
      preImage: getRandomBytes32(),
      recipient: params.recipient,
    }) as Promise<PublicResults.ConditionalTransfer>;
  };

  public withdraw = async (params: PublicParams.Withdraw): Promise<PublicResults.Withdraw> => {
    await this.assertFreeBalanceNotDisputed();
    return this.withdrawalController.withdraw(params);
  };

  public respondToNodeWithdraw = async (appInstance: AppInstanceJson): Promise<void> => {
    await this.assertFreeBalanceNotDisputed();
    return this.withdrawalController.respondToNodeWithdraw(appInstance);
  };

  public saveWithdrawCommitmentToStore = (
    params: PublicParams.Withdraw,
    signatures: string[],
    withdrawTx?: string,
  ): Promise<void> => {
    return this.withdrawalController.saveWithdrawCommitmentToStore(params, signatures, withdrawTx);
  };

  public resolveCondition = async (
    params: PublicParams.ResolveCondition,
  ): Promise<PublicResults.ResolveCondition> => {
    // paymentId is generated for hashlock transfer
    await this.assertFreeBalanceNotDisputed();
    if (params.conditionType === ConditionalTransferTypes.HashLockTransfer && !params.paymentId) {
      const lockHash = soliditySha256(["bytes32"], [params.preImage]);
      const paymentId = soliditySha256(["address", "bytes32"], [params.assetId, lockHash]);
      params.paymentId = paymentId;
    }
    return this.resolveTransferController.resolveTransfer(params);
  };

  public conditionalTransfer = async (
    params: PublicParams.ConditionalTransfer,
  ): Promise<PublicResults.ConditionalTransfer> => {
    await this.assertFreeBalanceNotDisputed();
    params.assetId = params.assetId || CONVENTION_FOR_ETH_ASSET_ID;
    return this.createTransferController.createTransfer(params);
  };

  public getHashLockTransfer = async (
    lockHash: string,
    assetId: string = AddressZero,
  ): Promise<NodeResponses.GetHashLockTransfer> => {
    return this.node.getHashLockTransfer(lockHash, assetId);
  };

  public getUserWithdrawals = async (): Promise<WithdrawalMonitorObject[]> => {
    const values = await this.channelProvider.send(ChannelMethods.chan_getUserWithdrawal, {});

    // sanity check
    values.forEach((val) => {
      const noRetry = typeof val.retry === "undefined" || val.retry === null;
      if (!val.tx || noRetry) {
        const msg = `Can not find tx or retry in retrieved user withdrawal ${stringify(val())}`;
        this.log.error(msg);
        throw new Error(msg);
      }
    });

    return values;
  };

  // this function should be called when the user knows a withdrawal should
  // be submitted. if there is no withdrawal expected, this promise will last
  // for the duration of the timeout
  public watchForUserWithdrawal = async (): Promise<providers.TransactionReceipt[]> => {
    const startingBlock = await this.ethProvider.getBlockNumber();

    // TODO: update comment
    // If this method is called immediately after installing the withdrawal app, the monitor
    // object might not be in the store yet. We should still wait for at least 1 withdrawal
    const withdrawalsToFind = await this.getUserWithdrawals();
    this.log.info(
      `Watching for ${withdrawalsToFind.length} withdrawal starting at block ${startingBlock}`,
    );
    const receipts = await Promise.all(
      withdrawalsToFind.map(async (storedValue) => {
        let receipt = await this.ethProvider.getTransactionReceipt(storedValue.withdrawalTx);
        if (receipt) {
          // tx was mined
          await this.channelProvider.send(ChannelMethods.chan_setUserWithdrawal, {
            withdrawalObject: storedValue,
            remove: true,
          });
          return receipt;
        }
        const tx = await this.ethProvider.getTransaction(storedValue.withdrawalTx);
        receipt = await tx.wait();
        return receipt;
      }),
    );
    return receipts;
  };

  ////////////////////////////////////////
  // Restore State

  public restoreState = async (): Promise<void> => {
    try {
      await this.channelProvider.send(ChannelMethods.chan_restoreState, {});
      this.log.info(`Found state to restore from store's backup`);
    } catch (e) {
      const toRestore = await this.node.restoreState(this.publicIdentifier);
      const { channel, setupCommitment, setStateCommitments, conditionalCommitments } = toRestore;
      if (!channel) {
        throw new Error(`No matching states found by node for ${this.publicIdentifier}`);
      }
      this.log.info(`Found state to restore from node: ${stringify(toRestore, false, 0)}`);
      await this.channelProvider.send(ChannelMethods.chan_setStateChannel, {
        state: channel,
        setupCommitment,
        setStateCommitments,
        conditionalCommitments,
      });
      this.log.info(`Restored channel: ${stringify(await this.getStateChannel(), false, 0)}`);
    }
    await this.restart();
  };

  ///////////////////////////////////
  // EVENT METHODS

  public on = <T extends EventName>(
    event: T,
    callback: (payload: EventPayload[T]) => void | Promise<void>,
    filter?: (payload: EventPayload[T]) => boolean,
  ) => {
    this.listener.attach(event, callback, filter);
  };

  public once = <T extends EventName>(
    event: T,
    callback: (payload: EventPayload[T]) => void | Promise<void>,
    filter?: (payload: EventPayload[T]) => boolean,
  ) => {
    this.listener.attachOnce(event, callback, filter);
  };

  public waitFor<T extends EventName>(
    event: T,
    timeout: number,
    filter?: (payload: EventPayload[T]) => boolean,
  ): Promise<EventPayload[T]> {
    return this.listener.waitFor(event, timeout, filter);
  }

  public off = async () => {
    await this.messaging.disconnect();
    await this.listener.detach();
    await this.channelProvider.removeAllListeners();
    await delay(500); // give messaging a bit more time to finish disconnecting
  };

  public emit = <T extends EventName>(event: T, payload: EventPayload[T]): boolean => {
    try {
      this.listener.post(event, payload);
      return true;
    } catch (e) {
      return false;
    }
  };

  ///////////////////////////////////
  // PROVIDER/ROUTER METHODS

  public deployMultisig = async (): Promise<MethodResults.DeployStateDepositHolder> => {
    return this.channelProvider.send(MethodNames.chan_deployStateDepositHolder, {
      multisigAddress: this.multisigAddress,
    });
  };

  public getStateChannel = async (): Promise<MethodResults.GetStateChannel> => {
    return this.channelProvider.send(MethodNames.chan_getStateChannel, {
      multisigAddress: this.multisigAddress,
    });
  };

  public getAppInstances = async (): Promise<AppInstanceJson[]> => {
    const { appInstances } = await this.channelProvider.send(MethodNames.chan_getAppInstances, {
      multisigAddress: this.multisigAddress,
    } as MethodParams.GetAppInstances);
    return appInstances;
  };

  public getFreeBalance = async (
    assetId: AssetId | Address = AddressZero,
  ): Promise<MethodResults.GetFreeBalanceState> => {
    if (typeof assetId !== "string") {
      throw new Error(`Asset id must be a string: ${stringify(assetId)}`);
    }
    const tokenAddress = getAddressFromAssetId(assetId);
    try {
      return await this.channelProvider.send(MethodNames.chan_getFreeBalanceState, {
        multisigAddress: this.multisigAddress,
        assetId: tokenAddress,
      } as MethodParams.GetFreeBalanceState);
    } catch (e) {
      const error = `No free balance exists for the specified token: ${tokenAddress}`;
      if (e.message.includes(error)) {
        // if there is no balance, return undefined
        // NOTE: can return free balance obj with 0s,
        // but need the nodes free balance
        // address in the multisig
        const obj = {};
        obj[this.nodeSignerAddress] = BigNumber.from(0);
        obj[this.signerAddress] = BigNumber.from(0);
        return obj;
      }
      throw e;
    }
  };

  public getProposedAppInstances = async (
    multisigAddress?: string,
  ): Promise<MethodResults.GetProposedAppInstances | undefined> => {
    return this.channelProvider.send(MethodNames.chan_getProposedAppInstances, {
      multisigAddress: multisigAddress || this.multisigAddress,
    } as MethodParams.GetProposedAppInstances);
  };

  public getProposedAppInstance = async (
    appIdentityHash: string,
  ): Promise<MethodResults.GetProposedAppInstance | undefined> => {
    return this.channelProvider.send(MethodNames.chan_getProposedAppInstance, {
      appIdentityHash,
    } as MethodParams.GetProposedAppInstance);
  };

  public getAppInstance = async (
    appIdentityHash: string,
  ): Promise<MethodResults.GetAppInstanceDetails | undefined> => {
    try {
      const ret = await this.channelProvider.send(MethodNames.chan_getAppInstance, {
        appIdentityHash,
      } as MethodParams.GetAppInstanceDetails);
      return ret;
    } catch (e) {
      if (e.message.includes(`No appInstance exists for identity hash`)) {
        return undefined;
      }
      throw e;
    }
  };

  public takeAction = async (
    appIdentityHash: string,
    action: AppAction,
    stateTimeout?: BigNumber,
  ): Promise<MethodResults.TakeAction> => {
    await this.assertFreeBalanceNotDisputed();
    // check the app is actually installed
    const err = await this.appNotInstalled(appIdentityHash);
    if (err) {
      this.log.error(err);
      throw new Error(err);
    }
    // check state is not finalized
    const { latestState: state } = (await this.getAppInstance(appIdentityHash)).appInstance;
    if ((state as any).finalized) {
      // FIXME: casting?
      throw new Error("Cannot take action on an app with a finalized state.");
    }
    return this.channelProvider.send(MethodNames.chan_takeAction, {
      action,
      appIdentityHash,
      stateTimeout,
      multisigAddress: this.multisigAddress,
    } as MethodParams.TakeAction);
  };

  public proposeInstallApp = async (
    params: MethodParams.ProposeInstall,
  ): Promise<MethodResults.ProposeInstall> => {
    return this.channelProvider.send(MethodNames.chan_proposeInstall, {
      ...(params as MethodParams.ProposeInstall),
      multisigAddress: this.multisigAddress,
    });
  };

  public installApp = async (appIdentityHash: string): Promise<MethodResults.Install> => {
    await this.assertFreeBalanceNotDisputed();
    // check the app isnt actually installed
    const alreadyInstalled = await this.appInstalled(appIdentityHash);
    if (alreadyInstalled) {
      throw new Error(alreadyInstalled);
    }
    return this.channelProvider.send(MethodNames.chan_install, {
      appIdentityHash,
      multisigAddress: this.multisigAddress,
    } as MethodParams.Install);
  };

  public uninstallApp = async (
    appIdentityHash: string,
    action?: AppAction,
  ): Promise<MethodResults.Uninstall> => {
    await this.assertFreeBalanceNotDisputed();
    // check the app is actually installed
    const err = await this.appNotInstalled(appIdentityHash);
    if (err) {
      this.log.error(err);
      throw new Error(err);
    }
    return this.channelProvider.send(MethodNames.chan_uninstall, {
      appIdentityHash,
      multisigAddress: this.multisigAddress,
      action,
    } as MethodParams.Uninstall);
  };

  public rejectInstallApp = async (
    appIdentityHash: string,
    reason?: string,
  ): Promise<MethodResults.Uninstall> => {
    return this.channelProvider.send(MethodNames.chan_rejectInstall, {
      appIdentityHash,
      multisigAddress: this.multisigAddress,
      reason,
    } as MethodParams.RejectInstall);
  };

  ///////////////////////////////////
  // NODE METHODS

  public clientCheckIn = async (): Promise<void> => {
    return this.node.clientCheckIn();
  };

  public reclaimPendingAsyncTransfers = async (): Promise<void> => {
    let installedTransfers: NodeResponses.GetPendingAsyncTransfers;
    const appInstances = await this.getAppInstances();
    // handle existing installed payment applications
    for (const app of appInstances) {
      if (app.meta?.recipient === this.publicIdentifier && app.meta?.encryptedPreImage) {
        this.log.info(`Found transfer to unlock: ${app.meta.paymentId}`);
        await this.reclaimPendingAsyncTransfer(app.meta.paymentId, app.meta.encryptedPreImage);
        this.log.info(`Unlocked transfer: ${app.meta.paymentId}`);
      }
    }
    try {
      this.log.info(`Attempting to install pending transfers`);
      installedTransfers = await this.node.installPendingTransfers();
      this.log.info(
        `Installed ${installedTransfers.length} transfers, should unlock automatically`,
      );
    } catch (e) {
      this.log.error(`Error installing pending transfers: ${e.message}`);
    }
  };

  // must be public so it can easily be used by the listener
  public reclaimPendingAsyncTransfer = async (
    paymentId: string,
    encryptedPreImage: string,
  ): Promise<PublicResults.ResolveLinkedTransfer> => {
    this.log.info(`Unlocking transfer ${paymentId}`);
    // decrypt secret and resolve
    const preImage = await this.channelProvider.send(ChannelMethods.chan_decrypt, {
      encryptedPreImage,
    });
    this.log.debug(`Decrypted message and recovered preImage: ${preImage}`);
    try {
      const response = await this.resolveTransferController.resolveTransfer({
        conditionType: ConditionalTransferTypes.LinkedTransfer,
        paymentId,
        preImage,
      });
      this.log.info(`Unlocked transfer ${paymentId} using preImage: ${preImage}`);
      return response;
    } catch (e) {
      this.log.error(`Error in reclaimPendingAsyncTransfer: ${e.message}`);
      throw e;
    }
  };

  ///////////////////////////////////
  // LOW LEVEL METHODS

  /**
   * NOTE: this function should *only* be called on `connect()`, and is
   * designed to cleanup channel state in the event of the client going
   * offline and not completing protocols.
   *
   * This function will *only* handle registered applications, or applications
   * who's desired functionality is well understood. The apps will be handled
   * as follows:
   * - proposed swaps: install will be rejected, removing them from the proposed
   *   app instances and preventing stale swaps from being installed.
   * - installed swaps: will be automatically uninstalled, thereby executing the
   *   swap as soon as the client is able.
   * - proposed linked transfer apps: reject install
   * - installed linked transfer: leave installed for the hub to uninstall
   */
  public cleanupRegistryApps = async (): Promise<void> => {
    this.log.info(`cleanupRegistryApps starting`);
    const swapAppRegistryInfo = this.appRegistry.find(
      (app: DefaultApp) => app.name === SimpleTwoPartySwapAppName,
    );
    const linkedRegistryInfo = this.appRegistry.find(
      (app: DefaultApp) => app.name === SimpleLinkedTransferAppName,
    );
    const withdrawRegistryInfo = this.appRegistry.find(
      (app: DefaultApp) => app.name === WithdrawAppName,
    );
    const depositRegistryInfo = this.appRegistry.find(
      (app: DefaultApp) => app.name === DepositAppName,
    );

    await this.removeHangingProposalsByDefinition([
      swapAppRegistryInfo.appDefinitionAddress,
      linkedRegistryInfo.appDefinitionAddress,
      withdrawRegistryInfo.appDefinitionAddress,
      depositRegistryInfo.appDefinitionAddress,
    ]);

    // deal with any apps that are installed and can simply
    // be uninstalled
    await this.uninstallAllAppsByDefintion([
      swapAppRegistryInfo.appDefinitionAddress,
      withdrawRegistryInfo.appDefinitionAddress,
    ]);

    await this.uninstallFinalizedApps();

    await this.uninstallExpiredApps();

    // handle any existing apps
    await this.handleInstalledDepositApps();
    this.log.info(`cleanupRegistryApps complete`);
  };

  /**
   * Removes all proposals of a give app definition type
   */
  private removeHangingProposalsByDefinition = async (appDefinitions: string[]): Promise<void> => {
    this.log.info(`removeHangingProposalsByDefinition starting: ${appDefinitions}`);
    // first get all proposed apps
    const { appInstances: proposed } = await this.getProposedAppInstances();

    // deal with any proposed swap or linked transfer apps
    const hangingProposals = proposed.filter((proposal: AppInstanceJson) =>
      appDefinitions.includes(proposal.appDefinition),
    );
    // remove from `proposedAppInstances`
    for (const hanging of hangingProposals) {
      try {
        await this.rejectInstallApp(hanging.identityHash, `Removing hanging proposals`);
      } catch (e) {
        this.log.error(
          `Could not remove proposal: ${hanging.identityHash}. Error: ${e.stack || e.message}`,
        );
      }
    }
    this.log.info(`removeHangingProposalsByDefinition complete!`);
  };

  /**
   * Removes all apps of a given app definition type
   */
  private uninstallAllAppsByDefintion = async (appDefinitions: string[]): Promise<void> => {
    this.log.info(`uninstallAllAppsByDefintion starting...: ${appDefinitions}`);

    const apps = (await this.getAppInstances()).filter((app: AppInstanceJson) =>
      appDefinitions.includes(app.appDefinition),
    );
    // TODO: ARJUN there is an edgecase where this will cancel withdrawal
    for (const app of apps) {
      try {
        await this.uninstallApp(app.identityHash);
      } catch (e) {
        this.log.error(
          `Could not uninstall app: ${app.identityHash}. Error: ${e.stack || e.message}`,
        );
      }
    }
    this.log.info(`uninstallAllAppsByDefintion complete!`);
  };

  /**
   * Removes all apps with a `true` `finalized` property in their `latestState`
   */
  private uninstallFinalizedApps = async (): Promise<void> => {
    this.log.info(`uninstallFinalizedApps starting`);
    const finalizedApps = (await this.getAppInstances()).filter(
      (app: AppInstanceJson) => app.latestState.finalized === true,
    );
    for (const app of finalizedApps) {
      try {
        this.log.info(`Uninstalling finalized app ${app.identityHash}...`);
        await this.uninstallApp(app.identityHash);
        this.log.info(`Finished uninstalling finalized app ${app.identityHash}`);
      } catch (e) {
        this.log.error(
          `Could not uninstall app: ${app.identityHash}. Error: ${e.stack || e.message}`,
        );
      }
    }
    this.log.info(`uninstallFinalizedApps complete!`);
  };

  /**
   * Removes all apps with a `true` `finalized` property in their `latestState`
   */
  private uninstallExpiredApps = async (): Promise<void> => {
    this.log.info(`uninstallExpiredApps starting`);
    const blockHeight = await this.ethProvider.getBlockNumber();
    const expiredApps = (await this.getAppInstances()).filter(
      (app: AppInstanceJson) => app.latestState.expiry && app.latestState.expiry >= blockHeight,
    );
    for (const app of expiredApps) {
      try {
        this.log.info(`Uninstalling expired app ${app.identityHash}...`);
        await this.uninstallApp(app.identityHash);
        this.log.info(`Finished uninstalling expired app ${app.identityHash}`);
      } catch (e) {
        this.log.error(
          `Could not uninstall app: ${app.identityHash}. Error: ${e.stack || e.message}`,
        );
      }
    }
    this.log.info(`uninstallExpiredApps complete!`);
  };

  private handleInstalledDepositApps = async () => {
    this.log.info(`handleInstalledDepositApps starting`);
    const assetIds = this.config.supportedTokenAddresses[this.chainId];
    for (const assetId of assetIds) {
      const { appIdentityHash } = await this.checkDepositRights({ assetId });
      if (!appIdentityHash) {
        // no deposit app installed for asset, continue
        continue;
      }
      // otherwise, handle installed app
      const {
        appInstance: { latestState },
      } = await this.getAppInstance(appIdentityHash);

      // there is still an active deposit, setup a listener to
      // rescind deposit rights when deposit is sent to multisig
      const currentMultisigBalance =
        assetId === AddressZero
          ? await this.ethProvider.getBalance(this.multisigAddress)
          : await new Contract(assetId, ERC20.abi, this.ethProvider).balanceOf(
              this.multisigAddress,
            );

      if (currentMultisigBalance.gt((latestState as DepositAppState).startingMultisigBalance)) {
        // deposit has occurred, rescind
        try {
          await this.rescindDepositRights({ assetId, appIdentityHash });
        } catch (e) {
          this.log.warn(
            `Could not uninstall deposit app ${appIdentityHash}. Error: ${e.stack || e.message}`,
          );
        }
        continue;
      }

      // there is still an active deposit, setup a listener to
      // rescind deposit rights when deposit is sent to multisig
      if (assetId === AddressZero) {
        this.ethProvider.on("block", async () => {
          const balance =
            assetId === AddressZero
              ? await this.ethProvider.getBalance(this.multisigAddress)
              : await new Contract(assetId, ERC20.abi, this.ethProvider).balanceOf(
                  this.multisigAddress,
                );
          if (balance.gt((latestState as DepositAppState).startingMultisigBalance)) {
            this.ethProvider.removeAllListeners("block");
            await this.rescindDepositRights({ assetId, appIdentityHash });
          }
        });
        continue;
      }

      new Contract(assetId, ERC20.abi, this.ethProvider).once(
        "Transfer",
        async (sender: string, recipient: string, amount: BigNumber) => {
          if (recipient === this.multisigAddress && amount.gt(0)) {
            const bal = await new Contract(assetId, ERC20.abi, this.ethProvider).balanceOf(
              this.multisigAddress,
            );
            if (bal.gt((latestState as DepositAppState).startingMultisigBalance)) {
              await this.rescindDepositRights({ assetId, appIdentityHash });
            }
          }
        },
      );
    }
    this.log.info(`handleInstalledDepositApps complete`);
  };

  private appNotInstalled = async (appIdentityHash: string): Promise<string | undefined> => {
    const apps = await this.getAppInstances();
    const app = apps.filter(
      (app: AppInstanceJson): boolean => app.identityHash === appIdentityHash,
    );
    if (!app || app.length === 0) {
      return (
        `Could not find installed app with id: ${appIdentityHash}. ` +
        `Installed apps: ${stringify(apps)}.`
      );
    }
    if (app.length > 1) {
      return (
        "CRITICAL ERROR: found multiple apps with the same id. " +
        `Installed apps: ${stringify(apps)}.`
      );
    }
    return undefined;
  };

  private appInstalled = async (appIdentityHash: string): Promise<string | undefined> => {
    const apps = await this.getAppInstances();
    const app = apps.filter(
      (app: AppInstanceJson): boolean => app.identityHash === appIdentityHash,
    );
    if (app.length > 0) {
      return (
        `App with id ${appIdentityHash} is already installed. ` +
        `Installed apps: ${stringify(apps)}.`
      );
    }
    return undefined;
  };

  private assertFreeBalanceNotDisputed = async () => {
    const channel = await this.store.getStateChannel(this.multisigAddress);
    if (!channel || !channel.freeBalanceAppInstance) {
      return;
    }
    const freeBalanceChallenge = await this.store.getAppChallenge(
      channel.freeBalanceAppInstance.identityHash,
    );
    if (
      freeBalanceChallenge &&
      freeBalanceChallenge.status !== StoredAppChallengeStatus.NO_CHALLENGE
    ) {
      throw new Error(`Free balance app has been disputed, cannot use channel.`);
    }
  };
}
