import { IMessagingService } from "@connext/messaging";
import { AppInstanceProposal, CF_PATH, LinkedTransferToRecipientParameters } from "@connext/types";
import "core-js/stable";
import EthCrypto from "eth-crypto";
import { Contract, providers } from "ethers";
import { AddressZero } from "ethers/constants";
import { BigNumber, bigNumberify, hexlify, Network, randomBytes, Transaction } from "ethers/utils";
import { fromMnemonic } from "ethers/utils/hdnode";
import tokenAbi from "human-standard-token-abi";
import "regenerator-runtime/runtime";

import { ChannelProvider, createCFChannelProvider } from "./channelProvider";
import { ConditionalTransferController } from "./controllers/ConditionalTransferController";
import { DepositController } from "./controllers/DepositController";
import { RequestDepositRightsController } from "./controllers/RequestDepositRightsController";
import { ResolveConditionController } from "./controllers/ResolveConditionController";
import { SwapController } from "./controllers/SwapController";
import { TransferController } from "./controllers/TransferController";
import { WithdrawalController } from "./controllers/WithdrawalController";
import { Logger, stringify, withdrawalKey, xpubToAddress } from "./lib";
import { ConnextListener } from "./listener";
import { NodeApiClient } from "./node";
import {
  Address,
  AppActionBigNumber,
  AppInstanceJson,
  AppRegistry,
  AppStateBigNumber,
  CFCoreChannel,
  CFCoreTypes,
  ChannelProviderConfig,
  ChannelState,
  CheckDepositRightsParameters,
  CheckDepositRightsResponse,
  ConditionalTransferParameters,
  ConditionalTransferResponse,
  ConnextClientStorePrefix,
  ConnextEvent,
  CreateChannelResponse,
  DefaultApp,
  DepositParameters,
  GetChannelResponse,
  GetConfigResponse,
  IConnextClient,
  InternalClientOptions,
  KeyGen,
  makeChecksum,
  makeChecksumOrEthAddress,
  PaymentProfile,
  RequestCollateralResponse,
  RequestDepositRightsParameters,
  RescindDepositRightsParameters,
  ResolveConditionParameters,
  ResolveConditionResponse,
  ResolveLinkedTransferResponse,
  Store,
  SupportedApplication,
  SupportedNetwork,
  SwapParameters,
  Transfer,
  TransferParameters,
  WithdrawalResponse,
  WithdrawParameters,
} from "./types";
import { invalidAddress } from "./validation/addresses";
import { falsy, notLessThanOrEqualTo, notPositive } from "./validation/bn";

const MAX_WITHDRAWAL_RETRIES = 3;

export class ConnextClient implements IConnextClient {
  public appRegistry: AppRegistry;
  public channelProvider: ChannelProvider;
  public config: GetConfigResponse;
  public ethProvider: providers.JsonRpcProvider;
  public freeBalanceAddress: string;
  public listener: ConnextListener;
  public log: Logger;
  public messaging: IMessagingService;
  public multisigAddress: Address;
  public network: Network;
  public node: NodeApiClient;
  public nodePublicIdentifier: string;
  public publicIdentifier: string;
  public signerAddress: Address;
  public store: Store;
  public token: Contract;

  private opts: InternalClientOptions;
  private keyGen: KeyGen;

  private depositController: DepositController;
  private transferController: TransferController;
  private swapController: SwapController;
  private withdrawalController: WithdrawalController;
  private conditionalTransferController: ConditionalTransferController;
  private resolveConditionController: ResolveConditionController;
  private requestDepositRightsController: RequestDepositRightsController;

  constructor(opts: InternalClientOptions) {
    this.opts = opts;
    this.appRegistry = opts.appRegistry;
    this.channelProvider = opts.channelProvider;
    this.config = opts.config;
    this.ethProvider = opts.ethProvider;
    this.keyGen = opts.keyGen;
    this.messaging = opts.messaging;
    this.network = opts.network;
    this.node = opts.node;
    this.token = opts.token;
    this.store = opts.store;

    this.freeBalanceAddress = this.channelProvider.config.freeBalanceAddress;
    this.signerAddress = this.channelProvider.config.signerAddress;
    this.publicIdentifier = this.channelProvider.config.userPublicIdentifier;
    this.multisigAddress = this.channelProvider.config.multisigAddress;
    this.nodePublicIdentifier = this.opts.config.nodePublicIdentifier;
    this.log = new Logger("ConnextClient", opts.logLevel);

    // establish listeners
    this.listener = new ConnextListener(opts.channelProvider, this);

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
    this.requestDepositRightsController = new RequestDepositRightsController(
      "RequestDepositRightsController",
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
          await new Promise((res: any): any => setTimeout((): void => res(), 100));
        }
        resolve();
      },
    );
  };

  /**
   * Checks if the coin balance refund app is installed.
   *
   * NOTE: should probably take assetId into account
   */
  public getBalanceRefundApp = async (
    assetId: string = AddressZero,
  ): Promise<AppInstanceJson | undefined> => {
    const apps = await this.getAppInstances(this.multisigAddress);
    const filtered = apps.filter(
      (app: AppInstanceJson) =>
        app.appInterface.addr === this.config.contractAddresses.CoinBalanceRefundApp &&
        app.latestState["tokenAddress"] === assetId,
    );
    return filtered.length === 0 ? undefined : filtered[0];
  };

  // register subscriptions
  public registerSubscriptions = async (): Promise<void> => {
    await this.listener.register();
  };

  ///////////////////////////////////
  // Unsorted methods pulled from the old abstract wrapper class

  public restart = async (): Promise<void> => {
    if (!this.channelProvider.isSigner) {
      this.log.warn(`Cannot restart with an injected provider.`);
      return;
    }
    // Create a fresh channelProvider & start using that.
    // End goal is to use this to restart the cfNode after restoring state
    const channelProvider = await createCFChannelProvider({
      ethProvider: this.ethProvider,
      keyGen: this.keyGen,
      lockService: { acquireLock: this.node.acquireLock.bind(this.node) },
      messaging: this.messaging as any,
      networkContext: this.config.contractAddresses,
      nodeConfig: { STORE_KEY_PREFIX: ConnextClientStorePrefix },
      nodeUrl: this.channelProvider.config.nodeUrl,
      store: this.store,
      xpub: this.publicIdentifier,
    });
    // TODO: this is very confusing to have to do, lets try to figure out a better way
    channelProvider.multisigAddress = this.multisigAddress;
    this.node.channelProvider = channelProvider;
    this.channelProvider = channelProvider;
    this.listener = new ConnextListener(channelProvider, this);
    await this.isAvailable();
  };

  public getChannel = async (): Promise<GetChannelResponse> => {
    return await this.node.getChannel();
  };

  public requestCollateral = async (
    tokenAddress: string,
  ): Promise<RequestCollateralResponse | void> => {
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
    return this.channelProvider.config;
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

  public requestDepositRights = async (
    params: RequestDepositRightsParameters,
  ): Promise<CFCoreTypes.RequestDepositRightsResult> => {
    return await this.requestDepositRightsController.requestDepositRights(params);
  };

  public rescindDepositRights = async (
    params: RescindDepositRightsParameters,
  ): Promise<CFCoreTypes.DepositResult> => {
    return await this.channelProvider.send(
      CFCoreTypes.RpcMethodNames.chan_rescindDepositRights as CFCoreTypes.RpcMethodName,
      {
        multisigAddress: this.multisigAddress,
        tokenAddress: params.assetId,
      } as CFCoreTypes.RescindDepositRightsParams,
    );
  };

  public checkDepositRights = async (
    params: CheckDepositRightsParameters,
  ): Promise<CheckDepositRightsResponse> => {
    const refundApp = await this.getBalanceRefundApp(params.assetId);
    const multisigBalance =
      !refundApp.latestState["tokenAddress"] &&
      refundApp.latestState["tokenAddress"] !== AddressZero
        ? await this.ethProvider.getBalance(this.multisigAddress)
        : await new Contract(
            refundApp.latestState["tokenAddress"],
            tokenAbi,
            this.ethProvider,
          ).functions.balanceOf(this.multisigAddress);
    return refundApp
      ? {
          assetId: refundApp.latestState["tokenAddress"],
          multisigBalance: multisigBalance.toString(),
          recipient: refundApp.latestState["recipient"],
          threshold: refundApp.latestState["threshold"],
        }
      : undefined;
  };

  public swap = async (params: SwapParameters): Promise<CFCoreChannel> => {
    return await this.swapController.swap(params);
  };

  /**
   * Transfer currently uses the conditionalTransfer "LINKED_TRANSFER_TO_RECIPIENT" so that
   * async payments are the default transfer.
   */
  public transfer = async (params: TransferParameters): Promise<ConditionalTransferResponse> => {
    return await this.conditionalTransferController.conditionalTransfer({
      amount: params.amount,
      assetId: params.assetId,
      conditionType: "LINKED_TRANSFER_TO_RECIPIENT",
      meta: params.meta,
      paymentId: hexlify(randomBytes(32)),
      preImage: hexlify(randomBytes(32)),
      recipient: params.recipient,
    } as LinkedTransferToRecipientParameters);
  };

  public withdraw = async (params: WithdrawParameters): Promise<WithdrawalResponse> => {
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
    const path = withdrawalKey(this.publicIdentifier);
    const value = await this.channelProvider.send("chan_storeGet", { path });

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
              await this.channelProvider.send("chan_storeSet", {
                pairs: [{ path: withdrawalKey(this.publicIdentifier), value: undefined }],
              });
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

  ////////////////////////////////////////
  // Restore State

  public restoreState = async (): Promise<void> => {
    const path = `${ConnextClientStorePrefix}/${this.publicIdentifier}/channel/${this.multisigAddress}`;
    let state;
    try {
      state = await this.channelProvider.send("chan_restoreState", { path });
      this.log.info(`Found state to restore from store's backup: ${stringify(state.path)}`);
    } catch (e) {
      state = await this.node.restoreState(this.publicIdentifier);
      if (!state) {
        throw new Error(`No matching states found by node for ${this.publicIdentifier}`);
      }
      this.log.info(`Found state to restore from node: ${stringify(state)}`);
    }
    await this.channelProvider.send("chan_storeSet", {
      pairs: [{ path, value: state }],
    });
    await this.restart();
  };

  ///////////////////////////////////
  // EVENT METHODS

  public on = (event: ConnextEvent, callback: (...args: any[]) => void): ConnextListener => {
    return this.listener.on(event, callback);
  };

  public once = (event: ConnextEvent, callback: (...args: any[]) => void): ConnextListener => {
    return this.listener.once(event, callback);
  };

  public emit = (event: ConnextEvent, data: any): boolean => {
    return this.listener.emit(event, data);
  };

  ///////////////////////////////////
  // PROVIDER/ROUTER METHODS

  public getStateChannel = async (): Promise<CFCoreTypes.GetStateChannelResult> => {
    return await this.channelProvider.send(
      CFCoreTypes.RpcMethodNames.chan_getStateChannel as CFCoreTypes.RpcMethodName,
      {
        multisigAddress: this.multisigAddress,
      },
    );
  };

  public providerDeposit = async (
    amount: BigNumber,
    assetId: string,
    notifyCounterparty: boolean = false,
  ): Promise<CFCoreTypes.DepositResult> => {
    const depositAddr = xpubToAddress(this.publicIdentifier);
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
    return await this.channelProvider.send(
      CFCoreTypes.RpcMethodNames.chan_deposit as CFCoreTypes.RpcMethodName,
      {
        amount,
        multisigAddress: this.multisigAddress,
        notifyCounterparty,
        tokenAddress: makeChecksum(assetId),
      } as CFCoreTypes.DepositParams,
    );
  };

  public getAppInstances = async (multisigAddress?: string): Promise<AppInstanceJson[]> => {
    const { appInstances } = await this.channelProvider.send(
      CFCoreTypes.RpcMethodNames.chan_getAppInstances as CFCoreTypes.RpcMethodName,
      {
        multisigAddress,
      } as CFCoreTypes.GetAppInstancesParams,
    );
    return appInstances;
  };

  public getFreeBalance = async (
    assetId: string = AddressZero,
  ): Promise<CFCoreTypes.GetFreeBalanceStateResult> => {
    if (typeof assetId !== "string") {
      throw new Error(`Asset id must be a string: ${stringify(assetId)}`);
    }
    const normalizedAssetId = makeChecksum(assetId);
    try {
      return await this.channelProvider.send(
        CFCoreTypes.RpcMethodNames.chan_getFreeBalanceState as CFCoreTypes.RpcMethodName,
        {
          multisigAddress: this.multisigAddress,
          tokenAddress: makeChecksum(assetId),
        } as CFCoreTypes.GetFreeBalanceStateParams,
      );
    } catch (e) {
      const error = `No free balance exists for the specified token: ${normalizedAssetId}`;
      if (e.message.includes(error)) {
        // if there is no balance, return undefined
        // NOTE: can return free balance obj with 0s,
        // but need the nodes free balance
        // address in the multisig
        const obj = {};
        obj[xpubToAddress(this.nodePublicIdentifier)] = new BigNumber(0);
        obj[this.freeBalanceAddress] = new BigNumber(0);
        return obj;
      }
      throw e;
    }
  };

  public getProposedAppInstances = async (
    multisigAddress?: string,
  ): Promise<CFCoreTypes.GetProposedAppInstancesResult | undefined> => {
    return await this.channelProvider.send(
      CFCoreTypes.RpcMethodNames.chan_getProposedAppInstances as CFCoreTypes.RpcMethodName,
      {
        multisigAddress,
      } as CFCoreTypes.GetProposedAppInstancesParams,
    );
  };

  public getProposedAppInstance = async (
    appInstanceId: string,
  ): Promise<CFCoreTypes.GetProposedAppInstanceResult | undefined> => {
    return await this.channelProvider.send(
      CFCoreTypes.RpcMethodNames.chan_getProposedAppInstances as CFCoreTypes.RpcMethodName,
      {
        appInstanceId,
      } as CFCoreTypes.GetProposedAppInstanceParams,
    );
  };

  public getAppInstanceDetails = async (
    appInstanceId: string,
  ): Promise<CFCoreTypes.GetAppInstanceDetailsResult | undefined> => {
    const err = await this.appNotInstalled(appInstanceId);
    if (err) {
      this.log.warn(err);
      return undefined;
    }
    return await this.channelProvider.send(
      CFCoreTypes.RpcMethodNames.chan_getAppInstance as CFCoreTypes.RpcMethodName,
      {
        appInstanceId,
      } as CFCoreTypes.GetAppInstanceDetailsParams,
    );
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
    return await this.channelProvider.send(
      CFCoreTypes.RpcMethodNames.chan_getState as CFCoreTypes.RpcMethodName,
      {
        appInstanceId,
      } as CFCoreTypes.GetStateParams,
    );
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
    return await this.channelProvider.send(
      CFCoreTypes.RpcMethodNames.chan_takeAction as CFCoreTypes.RpcMethodName,
      {
        action,
        appInstanceId,
      } as CFCoreTypes.TakeActionParams,
    );
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
    return await this.channelProvider.send(
      CFCoreTypes.RpcMethodNames.chan_updateState as CFCoreTypes.RpcMethodName,
      {
        appInstanceId,
        newState,
      } as CFCoreTypes.UpdateStateParams,
    );
  };

  public proposeInstallApp = async (
    params: CFCoreTypes.ProposeInstallParams,
  ): Promise<CFCoreTypes.ProposeInstallResult> => {
    return await this.channelProvider.send(
      CFCoreTypes.RpcMethodNames.chan_proposeInstall as CFCoreTypes.RpcMethodName,
      params as CFCoreTypes.ProposeInstallParams,
    );
  };

  public installVirtualApp = async (
    appInstanceId: string,
  ): Promise<CFCoreTypes.InstallVirtualResult> => {
    // check the app isnt actually installed
    const alreadyInstalled = await this.appInstalled(appInstanceId);
    if (alreadyInstalled) {
      throw new Error(alreadyInstalled);
    }
    return await this.channelProvider.send(
      CFCoreTypes.RpcMethodNames.chan_installVirtual as CFCoreTypes.RpcMethodName,
      {
        appInstanceId,
        intermediaryIdentifier: this.nodePublicIdentifier,
      } as CFCoreTypes.InstallVirtualParams,
    );
  };

  public installApp = async (appInstanceId: string): Promise<CFCoreTypes.InstallResult> => {
    // check the app isnt actually installed
    const alreadyInstalled = await this.appInstalled(appInstanceId);
    if (alreadyInstalled) {
      throw new Error(alreadyInstalled);
    }
    return await this.channelProvider.send(
      CFCoreTypes.RpcMethodNames.chan_install as CFCoreTypes.RpcMethodName,
      {
        appInstanceId,
      } as CFCoreTypes.InstallParams,
    );
  };

  public uninstallApp = async (appInstanceId: string): Promise<CFCoreTypes.UninstallResult> => {
    // check the app is actually installed
    const err = await this.appNotInstalled(appInstanceId);
    if (err) {
      this.log.error(err);
      throw new Error(err);
    }
    return await this.channelProvider.send(
      CFCoreTypes.RpcMethodNames.chan_uninstall as CFCoreTypes.RpcMethodName,
      {
        appInstanceId,
      } as CFCoreTypes.UninstallParams,
    );
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

    return await this.channelProvider.send(
      CFCoreTypes.RpcMethodNames.chan_uninstallVirtual as CFCoreTypes.RpcMethodName,
      {
        appInstanceId,
        intermediaryIdentifier: this.nodePublicIdentifier,
      } as CFCoreTypes.UninstallVirtualParams,
    );
  };

  public rejectInstallApp = async (appInstanceId: string): Promise<CFCoreTypes.UninstallResult> => {
    return await this.channelProvider.send(
      CFCoreTypes.RpcMethodNames.chan_rejectInstall as CFCoreTypes.RpcMethodName,
      {
        appInstanceId,
      },
    );
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

    return await this.channelProvider.send(
      CFCoreTypes.RpcMethodNames.chan_withdraw as CFCoreTypes.RpcMethodName,
      {
        amount,
        multisigAddress: this.multisigAddress,
        recipient,
        tokenAddress: makeChecksum(assetId),
      } as CFCoreTypes.WithdrawParams,
    );
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
    return await this.channelProvider.send(
      CFCoreTypes.RpcMethodNames.chan_withdrawCommitment as CFCoreTypes.RpcMethodName,
      {
        amount,
        multisigAddress: this.multisigAddress,
        recipient,
        tokenAddress: makeChecksumOrEthAddress(assetId),
      } as CFCoreTypes.WithdrawCommitmentParams,
    );
  };

  ///////////////////////////////////
  // NODE METHODS

  public verifyAppSequenceNumber = async (): Promise<any> => {
    const { data: sc } = await this.channelProvider.send("chan_getStateChannel" as any, {
      multisigAddress: this.multisigAddress,
    });
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
      const { encryptedPreImage, paymentId } = transfer;
      await this.reclaimPendingAsyncTransfer(paymentId, encryptedPreImage);
    }
  };

  public reclaimPendingAsyncTransfer = async (
    paymentId: string,
    encryptedPreImage: string,
  ): Promise<ResolveLinkedTransferResponse> => {
    this.log.info(`Reclaiming transfer ${paymentId}`);
    // decrypt secret and resolve
    let privateKey: string;
    if (this.opts.mnemonic) {
      privateKey = fromMnemonic(this.opts.mnemonic)
        .derivePath(CF_PATH)
        .derivePath("0").privateKey;
    } else if (this.keyGen) {
      // TODO: make this use app key?
      privateKey = await this.keyGen("0");
    } else {
      throw new Error(`No way to decode transfer, this should never happen!`);
    }

    const cipher = EthCrypto.cipher.parse(encryptedPreImage);

    const preImage = await EthCrypto.decryptWithPrivateKey(privateKey, cipher);
    this.log.debug(`Decrypted message and recovered preImage: ${preImage}`);
    const response = await this.resolveCondition({
      conditionType: "LINKED_TRANSFER_TO_RECIPIENT",
      paymentId,
      preImage,
    });
    this.log.info(`Reclaimed transfer ${stringify(response)}`);
    return response;
  };

  ///////////////////////////////////
  // LOW LEVEL METHODS

  public getRegisteredAppDetails = (appName: SupportedApplication): DefaultApp => {
    const appInfo = this.appRegistry.filter((app: DefaultApp): boolean => {
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
    givenTransaction: Transaction | undefined,
    expected: CFCoreTypes.MinimalTransaction,
  ): boolean => {
    return (
      givenTransaction &&
      givenTransaction.to === expected.to &&
      bigNumberify(givenTransaction.value).eq(expected.value) &&
      givenTransaction.data === expected.data
    );
  };

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
    const swapAppRegistryInfo = this.appRegistry.filter(
      (app: DefaultApp) => app.name === "SimpleTwoPartySwapApp",
    )[0];
    const linkedRegistryInfo = this.appRegistry.filter(
      (app: DefaultApp) => app.name === "SimpleLinkedTransferApp",
    )[0];

    await this.removeHangingProposalsByDefinition([
      swapAppRegistryInfo.appDefinitionAddress,
      linkedRegistryInfo.appDefinitionAddress,
    ]);

    // deal with any swap apps that are installed
    await this.uninstallAllAppsByDefintion([swapAppRegistryInfo.appDefinitionAddress]);
  };

  /**
   * Removes all proposals of a give app definition type
   */
  public removeHangingProposalsByDefinition = async (appDefinitions: string[]): Promise<void> => {
    // first get all proposed apps
    const { appInstances: proposed } = await this.getProposedAppInstances();

    // deal with any proposed swap or linked transfer apps
    const hangingProposals = proposed.filter((proposal: AppInstanceProposal) =>
      appDefinitions.includes(proposal.appDefinition),
    );
    // remove from `proposedAppInstances`
    for (const hanging of hangingProposals) {
      await this.rejectInstallApp(hanging.identityHash);
    }
  };

  /**
   * Removes all apps of a given app definition type
   */
  public uninstallAllAppsByDefintion = async (appDefinitions: string[]): Promise<void> => {
    const apps = (await this.getAppInstances()).filter((app: AppInstanceJson) =>
      appDefinitions.includes(app.appInterface.addr),
    );
    for (const app of apps) {
      await this.uninstallApp(app.identityHash);
    }
  };

  public uninstallCoinBalanceIfNeeded = async (assetId: string = AddressZero): Promise<void> => {
    // check if there is a coin refund app installed
    const coinRefund = await this.getBalanceRefundApp(assetId);
    if (!coinRefund) {
      this.log.debug("No coin balance refund app found");
      return undefined;
    }

    const latestState = coinRefund.latestState;
    const threshold = bigNumberify(latestState["threshold"]);
    const isTokenDeposit =
      latestState["tokenAddress"] && latestState["tokenAddress"] !== AddressZero;
    const isClientDeposit = latestState["recipient"] === this.freeBalanceAddress;

    const multisigBalance = !isTokenDeposit
      ? await this.ethProvider.getBalance(this.multisigAddress)
      : await new Contract(
          latestState["tokenAddress"],
          tokenAbi,
          this.ethProvider,
        ).functions.balanceOf(this.multisigAddress);

    if (multisigBalance.lt(threshold)) {
      throw new Error(
        `Something is wrong! multisig balance is less than the threshold of the installed coin balance refund app.`,
      );
    }

    // define helper fn to uninstall coin balance refund
    const uninstallRefund = async (): Promise<void> => {
      this.log.debug("Deposit has been executed, uninstalling refund app");
      // deposit has been executed, uninstall
      await this.uninstallApp(coinRefund.identityHash);
      this.log.debug("Successfully uninstalled");
    };

    // deposit still needs to be executed, wait to uninstall
    if (multisigBalance.eq(threshold)) {
      this.log.warn(
        `Coin balance refund app found installed, but no deposit successfully executed. Leaving app installed and waiting for deposit of ${
          latestState["tokenAddress"]
        } from ${isClientDeposit ? `client` : `node`}`,
      );
      // if the deposit is from the user, register a listener to wait for
      // for successful uninstalling since their queued uninstall request
      // would be lost. if the deposit is from the node, they will be waiting
      // to send an uninstall request to the client
      if (isClientDeposit) {
        if (isTokenDeposit) {
          new Contract(assetId, tokenAbi, this.ethProvider).once(
            "Transfer",
            async (sender: string, recipient: string, amount: BigNumber) => {
              if (recipient === this.multisigAddress && amount.gt(0)) {
                this.log.info(`Multisig transfer was for our channel, uninstalling refund app`);
                await uninstallRefund();
              }
            },
          );
        } else {
          this.ethProvider.once(this.multisigAddress, async () => await uninstallRefund());
        }
      }
      return;
    }

    // multisig bal > threshold so deposit has been executed, uninstall
    await uninstallRefund();
  };

  public resubmitActiveWithdrawal = async (): Promise<void> => {
    const path = withdrawalKey(this.publicIdentifier);
    const withdrawal = await this.channelProvider.send("chan_storeGet", { path });

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
      await this.channelProvider.send("chan_storeSet", {
        pairs: [
          {
            path: withdrawalKey(this.publicIdentifier),
            value: undefined,
          },
        ],
      });
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
    await this.channelProvider.send("chan_storeSet", {
      pairs: [
        {
          path: withdrawalKey(this.publicIdentifier),
          value: { tx, retry },
        },
      ],
    });
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
    const apps = await this.getAppInstances(this.multisigAddress);
    const app = apps.filter((app: AppInstanceJson): boolean => app.identityHash === appInstanceId);
    if (!app || app.length === 0) {
      return (
        `Could not find installed app with id: ${appInstanceId}. ` +
        `Installed apps: ${stringify(apps)}.`
      );
    }
    if (app.length > 1) {
      return (
        `CRITICAL ERROR: found multiple apps with the same id. ` +
        `Installed apps: ${stringify(apps)}.`
      );
    }
    return undefined;
  };

  private appInstalled = async (appInstanceId: string): Promise<string | undefined> => {
    const apps = await this.getAppInstances(this.multisigAddress);
    const app = apps.filter((app: AppInstanceJson): boolean => app.identityHash === appInstanceId);
    if (app.length > 0) {
      return (
        `App with id ${appInstanceId} is already installed. ` +
        `Installed apps: ${stringify(apps)}.`
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
