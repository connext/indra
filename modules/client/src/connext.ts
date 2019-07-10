import { NatsServiceFactory } from "@connext/nats-messaging-client";
import {
  AppRegistry,
  ChannelState,
  DepositParameters,
  SwapParameters,
  GetConfigResponse,
  NodeChannel,
  SupportedApplication,
  TransferAction,
  TransferParameters,
  WithdrawParameters,
} from "@connext/types";
import { jsonRpcDeserialize, MNEMONIC_PATH, Node } from "@counterfactual/node";
import { Address, AppInstanceInfo, Node as NodeTypes, OutcomeType } from "@counterfactual/types";
import { Zero } from "ethers/constants";
import { BigNumber, Network } from "ethers/utils";
import { fromExtendedKey } from "ethers/utils/hdnode";
import { Client as NatsClient, Payload } from "ts-nats";

import { DepositController } from "./controllers/DepositController";
import { SwapController } from "./controllers/SwapController";
import { TransferController } from "./controllers/TransferController";
import { WithdrawalController } from "./controllers/WithdrawalController";
import { Logger } from "./lib/logger";
import { logEthFreeBalance, publicIdentifierToAddress } from "./lib/utils";
import { ConnextListener } from "./listener";
import { NodeApiClient } from "./node";
import { ClientOptions, InternalClientOptions } from "./types";
import { invalidAddress } from "./validation/addresses";
import { falsy, notLessThanOrEqualTo, notPositive } from "./validation/bn";
import { Wallet } from "./wallet";

/**
 * Creates a new client-node connection with node at specified url
 *
 * @param opts The options to instantiate the client with.
 * At a minimum, must contain the nodeUrl and a client signing key or mnemonic
 */

export async function connect(opts: ClientOptions): Promise<ConnextInternal> {
  // create a new wallet
  const wallet = new Wallet(opts);
  const network = await wallet.provider.getNetwork();

  // create a new internal nats instance
  const natsConfig = {
    clusterId: opts.natsClusterId,
    payload: Payload.JSON,
    servers: [opts.natsUrl],
    token: opts.natsToken,
  };
  // TODO: proper key? also, proper usage?
  const messagingServiceKey = "messaging";
  // connect nats service, done as part of async setup

  // TODO: get config from nats client?
  console.log("creating nats client from config:", JSON.stringify(natsConfig));
  // TODO: instantiate service factory with proper config!!
  // @ts-ignore
  const natsFactory = new NatsServiceFactory(natsConfig);
  const messaging = natsFactory.createMessagingService(messagingServiceKey);
  await messaging.connect();
  console.log("nats is connected");

  // TODO: we need to pass in the whole store to retain context. Figure out how to do this better
  // Note: added this to the client since this is required for the cf module to work
  await opts.store.set([{ key: MNEMONIC_PATH, value: opts.mnemonic }]);

  // create a new node api instance
  // TODO: use local storage for default key value setting!!
  const nodeConfig = {
    logLevel: opts.logLevel,
    nats: messaging.getConnection(),
    nodeUrl: opts.nodeUrl,
    wallet,
  };
  console.log("creating node client");
  const node: NodeApiClient = new NodeApiClient(nodeConfig);
  console.log("created node client successfully");

  const config = await node.config();
  console.log(`node eth network: ${JSON.stringify(config.ethNetwork)}`);

  // create new cfModule to inject into internal instance
  console.log("creating new cf module");
  const cfModule = await Node.create(
    messaging,
    opts.store,
    {
      STORE_KEY_PREFIX: "store",
    }, // TODO: proper config
    wallet.provider,
    config.contractAddresses,
  );
  node.setPublicIdentifier(cfModule.publicIdentifier);
  console.log("created cf module successfully");

  console.log("creating listener");
  const listener: ConnextListener = new ConnextListener(cfModule, opts.logLevel);
  console.log("created listener");

  // TODO: make these types
  let myChannel = await node.getChannel();

  if (!myChannel) {
    // TODO: make these types
    console.log("no channel detected, creating channel..");
    myChannel = await node.createChannel();
  }
  console.log("myChannel: ", myChannel);
  // create the new client
  return new ConnextInternal({
    cfModule,
    listener,
    multisigAddress: myChannel.multisigAddress,
    nats: messaging.getConnection(),
    network,
    node,
    nodePublicIdentifier: config.nodePublicIdentifier,
    wallet,
    ...opts, // use any provided opts by default
  });
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
  private internal: ConnextInternal;

  public constructor(opts: InternalClientOptions) {
    this.opts = opts;
    this.internal = this as any;
  }

  ///////////////////////////////////
  // LISTENER METHODS
  public on = (event: NodeTypes.EventName, callback: (...args: any[]) => void): ConnextListener => {
    return this.internal.on(event, callback);
  };

  public emit = (event: NodeTypes.EventName, data: any): boolean => {
    return this.internal.emit(event, data);
  };

  ///////////////////////////////////
  // CORE CHANNEL METHODS

  // TODO: do we want the inputs to be an object?
  public deposit = async (params: DepositParameters): Promise<ChannelState> => {
    return await this.internal.deposit(params);
  };

  public swap = async (params: SwapParameters): Promise<ChannelState> => {
    return await this.internal.swap(params);
  };

  public transfer = async (params: TransferParameters): Promise<NodeChannel> => {
    return await this.internal.transfer(params);
  };

  public withdraw = async (params: WithdrawParameters): Promise<ChannelState> => {
    return await this.internal.withdraw(params);
  };

  ///////////////////////////////////
  // NODE EASY ACCESS METHODS
  public config = async (): Promise<GetConfigResponse> => {
    return await this.internal.config();
  };

  public getChannel = async (): Promise<NodeChannel> => {
    return await this.internal.node.getChannel();
  };

  ///////////////////////////////////
  // CF MODULE EASY ACCESS METHODS
  public getFreeBalance = async (): Promise<NodeTypes.GetFreeBalanceStateResult> => {
    return await this.internal.getFreeBalance();
  };

  // TODO: remove this when not testing (maybe?)
  // FIXME: remove
  public logEthFreeBalance = (
    freeBalance: NodeTypes.GetFreeBalanceStateResult,
    log?: Logger,
  ): void => {
    logEthFreeBalance(freeBalance, log);
  };

  public getAppInstances = async (): Promise<AppInstanceInfo[]> => {
    return await this.internal.getAppInstances();
  };

  public getAppInstanceDetails = async (
    appInstanceId: string,
  ): Promise<NodeTypes.GetAppInstanceDetailsResult> => {
    return await this.internal.getAppInstanceDetails(appInstanceId);
  };

  public getAppState = async (appInstanceId: string): Promise<NodeTypes.GetStateResult> => {
    return await this.internal.getAppState(appInstanceId);
  };

  public installTransferApp = async (
    counterpartyPublicIdentifier: string,
    initialDeposit: BigNumber,
  ): Promise<NodeTypes.ProposeInstallVirtualResult> => {
    return await this.internal.installTransferApp(counterpartyPublicIdentifier, initialDeposit);
  };

  public uninstallVirtualApp = async (
    appInstanceId: string,
  ): Promise<NodeTypes.UninstallVirtualResult> => {
    return await this.internal.uninstallVirtualApp(appInstanceId);
  };
}

/**
 * True implementation of the connext client
 */
export class ConnextInternal extends ConnextChannel {
  public opts: InternalClientOptions;
  public cfModule: Node;
  public publicIdentifier: string;
  public wallet: Wallet;
  public node: NodeApiClient;
  public nats: NatsClient;
  public multisigAddress: Address;
  public listener: ConnextListener;
  public nodePublicIdentifier: string;
  public freeBalanceAddress: string;
  // TODO: maybe move this into the NodeApiClient @layne? --> yes

  public logger: Logger;
  public network: Network;

  ////////////////////////////////////////
  // Setup channel controllers
  private depositController: DepositController;
  private transferController: TransferController;
  private swapController: SwapController;
  private withdrawalController: WithdrawalController;

  constructor(opts: InternalClientOptions) {
    super(opts);

    this.opts = opts;

    this.wallet = opts.wallet;
    this.node = opts.node;
    this.nats = opts.nats;

    this.cfModule = opts.cfModule;
    this.freeBalanceAddress = this.cfModule.ethFreeBalanceAddress;
    this.publicIdentifier = this.cfModule.publicIdentifier;
    this.multisigAddress = this.opts.multisigAddress;
    this.nodePublicIdentifier = this.opts.nodePublicIdentifier;

    this.logger = new Logger("ConnextInternal", opts.logLevel);
    // TODO: fix with bos config!
    this.network = opts.network;

    // establish listeners
    this.listener = opts.listener;
    this.connectDefaultListeners();

    // instantiate controllers with logger and cf
    this.depositController = new DepositController("DepositController", this);
    this.transferController = new TransferController("TransferController", this);
    this.swapController = new SwapController("SwapController", this);
    this.withdrawalController = new WithdrawalController("WithdrawalController", this);
  }

  ///////////////////////////////////
  // CORE CHANNEL METHODS

  public deposit = async (params: DepositParameters): Promise<ChannelState> => {
    return await this.depositController.deposit(params);
  };

  public swap = async (params: SwapParameters): Promise<ChannelState> => {
    return await this.swapController.swap(params);
  };

  public transfer = async (params: TransferParameters): Promise<NodeChannel> => {
    return await this.transferController.transfer(params);
  };

  public withdraw = async (params: WithdrawParameters): Promise<ChannelState> => {
    return await this.withdrawalController.withdraw(params);
  };

  ///////////////////////////////////
  // NODE METHODS

  public config = async (): Promise<GetConfigResponse> => {
    return await this.node.config();
  };

  ///////////////////////////////////
  // EVENT METHODS

  public on = (event: NodeTypes.EventName, callback: (...args: any[]) => void): ConnextListener => {
    return this.listener.on(event, callback);
  };

  public emit = (event: NodeTypes.EventName, data: any): boolean => {
    return this.listener.emit(event, data);
  };

  ///////////////////////////////////
  // CF MODULE METHODS

  // FIXME: add normal installation methods
  // and other wrappers for all cf node methods

  // TODO: erc20 support?
  public cfDeposit = async (
    amount: BigNumber,
    notifyCounterparty: boolean = true,
  ): Promise<NodeTypes.DepositResult> => {
    const depositAddr = publicIdentifierToAddress(this.cfModule.publicIdentifier);
    const bal = await this.wallet.provider.getBalance(depositAddr);
    const err = [
      notPositive(amount),
      notLessThanOrEqualTo(amount, bal), // cant deposit more than default addr owns
    ].filter(falsy)[0];
    if (err) {
      this.logger.error(err);
      throw new Error(err);
    }

    const depositResponse = await this.cfModule.router.dispatch(
      jsonRpcDeserialize({
        id: Date.now(),
        jsonrpc: "2.0",
        method: NodeTypes.RpcMethodName.DEPOSIT,
        params: {
          amount,
          multisigAddress: this.opts.multisigAddress,
          notifyCounterparty,
        },
      }),
    );
    // @ts-ignore --> WHYY?
    return depositResponse as NodeTypes.DepositResult;
  };

  // TODO: under what conditions will this fail?
  public getAppInstances = async (): Promise<AppInstanceInfo[]> => {
    const appInstanceResponse = await this.cfModule.router.dispatch(
      jsonRpcDeserialize({
        id: Date.now(),
        jsonrpc: "2.0",
        method: NodeTypes.RpcMethodName.GET_APP_INSTANCES,
        params: {} as NodeTypes.GetAppInstancesParams,
      }),
    );

    return appInstanceResponse.result.appInstances as AppInstanceInfo[];
  };

  // TODO: under what conditions will this fail?
  public getFreeBalance = async (): Promise<NodeTypes.GetFreeBalanceStateResult> => {
    const freeBalance = await this.cfModule.router.dispatch(
      jsonRpcDeserialize({
        id: Date.now(),
        jsonrpc: "2.0",
        method: NodeTypes.RpcMethodName.GET_FREE_BALANCE_STATE,
        params: { multisigAddress: this.multisigAddress },
      }),
    );

    return freeBalance.result as NodeTypes.GetFreeBalanceStateResult;
  };

  public getAppInstanceDetails = async (
    appInstanceId: string,
  ): Promise<NodeTypes.GetAppInstanceDetailsResult | undefined> => {
    const err = await this.appNotInstalled(appInstanceId);
    if (err) {
      this.logger.warn(err);
      return undefined;
    }
    const appInstanceResponse = await this.cfModule.router.dispatch(
      jsonRpcDeserialize({
        id: Date.now(),
        jsonrpc: "2.0",
        method: NodeTypes.RpcMethodName.GET_APP_INSTANCE_DETAILS,
        params: {
          appInstanceId,
        } as NodeTypes.GetAppInstanceDetailsParams,
      }),
    );

    return appInstanceResponse.result as NodeTypes.GetAppInstanceDetailsResult;
  };

  public getAppState = async (
    appInstanceId: string,
  ): Promise<NodeTypes.GetStateResult | undefined> => {
    // check the app is actually installed, or returned undefined
    const err = await this.appNotInstalled(appInstanceId);
    if (err) {
      this.logger.warn(err);
      return undefined;
    }
    const stateResponse = await this.cfModule.router.dispatch(
      jsonRpcDeserialize({
        id: Date.now(),
        jsonrpc: "2.0",
        method: NodeTypes.RpcMethodName.GET_STATE,
        params: {
          appInstanceId,
        } as NodeTypes.GetStateParams,
      }),
    );

    return stateResponse.result as NodeTypes.GetStateResult;
  };

  public takeAction = async (
    appInstanceId: string,
    action: TransferAction,
  ): Promise<NodeTypes.TakeActionResult> => {
    // check the app is actually installed
    const err = await this.appNotInstalled(appInstanceId);
    if (err) {
      this.logger.error(err);
      throw new Error(err);
    }
    // check state is not finalized
    const state: NodeTypes.GetStateResult = await this.getAppState(appInstanceId);
    // FIXME: casting?
    if ((state.state as any).finalized) {
      throw new Error("Cannot take action on an app with a finalized state.");
    }
    const actionResponse = await this.cfModule.router.dispatch(
      jsonRpcDeserialize({
        id: Date.now(),
        jsonrpc: "2.0",
        method: NodeTypes.RpcMethodName.TAKE_ACTION,
        params: {
          action,
          appInstanceId,
        } as NodeTypes.TakeActionParams,
      }),
    );

    return actionResponse.result as NodeTypes.TakeActionResult;
  };

  // TODO: add validation after arjuns refactor merged
  public proposeInstallVirtualApp = async (
    params: NodeTypes.ProposeInstallVirtualParams
  ): Promise<NodeTypes.ProposeInstallVirtualResult> => {
    params.intermediaries = [this.nodePublicIdentifier]

    const actionRes = await this.cfModule.router.dispatch(
      jsonRpcDeserialize({
        id: Date.now(),
        jsonrpc: "2.0",
        method: NodeTypes.RpcMethodName.PROPOSE_INSTALL_VIRTUAL,
        params,
      }),
    );

    return actionRes.result as NodeTypes.ProposeInstallVirtualResult;
  };

  // TODO: add validation after arjuns refactor merged
  public proposeInstallApp = async (
    params: NodeTypes.ProposeInstallParams
  ): Promise<NodeTypes.ProposeInstallResult> => {

    const actionRes = await this.cfModule.router.dispatch(
      jsonRpcDeserialize({
        id: Date.now(),
        jsonrpc: "2.0",
        method: NodeTypes.RpcMethodName.PROPOSE_INSTALL_VIRTUAL,
        params,
      }),
    );

    return actionRes.result as NodeTypes.ProposeInstallResult;
  };

  public installVirtualApp = async (
    appInstanceId: string,
  ): Promise<NodeTypes.InstallVirtualResult> => {
    // FIXME: make this helper?
    // check the app isnt actually installed
    const apps = await this.getAppInstances();
    const app = apps.filter((app: AppInstanceInfo) => app.identityHash === appInstanceId);
    if (app.length !== 0) {
      throw new Error(
        `Found already installed app with id: ${appInstanceId}. ` +
          `Installed apps: ${JSON.stringify(apps, null, 2)}`,
      );
    }
    const installVirtualResponse = await this.cfModule.router.dispatch(
      jsonRpcDeserialize({
        id: Date.now(),
        jsonrpc: "2.0",
        method: NodeTypes.RpcMethodName.INSTALL_VIRTUAL,
        params: {
          appInstanceId,
          intermediaries: [this.nodePublicIdentifier],
        } as NodeTypes.InstallVirtualParams,
      }),
    );

    return installVirtualResponse.result;
  };

  public uninstallVirtualApp = async (
    appInstanceId: string,
  ): Promise<NodeTypes.UninstallVirtualResult> => {
    // check the app is actually installed
    const err = await this.appNotInstalled(appInstanceId);
    if (err) {
      this.logger.error(err);
      throw new Error(err);
    }
    const uninstallResponse = await this.cfModule.router.dispatch(
      jsonRpcDeserialize({
        id: Date.now(),
        jsonrpc: "2.0",
        method: NodeTypes.RpcMethodName.UNINSTALL_VIRTUAL,
        params: {
          appInstanceId,
          intermediaryIdentifier: this.nodePublicIdentifier,
        },
      }),
    );

    return uninstallResponse.result as NodeTypes.UninstallVirtualResult;
  };

  // TODO: erc20 support?
  public withdrawal = async (
    amount: BigNumber,
    recipient?: string, // Address or xpub? whats the default?
  ): Promise<NodeTypes.UninstallResult> => {
    const freeBalance = await this.getFreeBalance();
    const preWithdrawalBal = freeBalance[this.cfModule.ethFreeBalanceAddress];
    const err = [
      notLessThanOrEqualTo(amount, preWithdrawalBal),
      recipient ? invalidAddress(recipient) : null, // check address of asset
    ].filter(falsy)[0];
    if (err) {
      this.logger.error(err);
      throw new Error(err);
    }
    const withdrawalResponse = await this.cfModule.router.dispatch(
      jsonRpcDeserialize({
        id: Date.now(),
        jsonrpc: "2.0",
        method: NodeTypes.RpcMethodName.WITHDRAW,
        params: {
          amount,
          multisigAddress: this.multisigAddress,
          recipient,
        },
      }),
    );

    return withdrawalResponse.result;
  };

  ///////////////////////////////////
  // LOW LEVEL METHODS

  // TODO: make sure types are all good
  private connectDefaultListeners = (): void => {
    // counterfactual listeners
    this.listener.registerDefaultCfListeners();
  };

  private appNotInstalled = async (appInstanceId: string): Promise<string | undefined> => {
    const apps = await this.getAppInstances();
    const app = apps.filter((app: AppInstanceInfo) => app.identityHash === appInstanceId);
    if (!app || app.length === 0) {
      return (
        `Could not find installed app with id: ${appInstanceId}.` +
        `Installed apps: ${JSON.stringify(apps, null, 2)}.`
      );
    }
    if (app.length > 1) {
      return (
        `CRITICAL ERROR: found multiple apps with the same id. ` +
        `Installed apps: ${JSON.stringify(apps, null, 2)}.`
      );
    }
    return undefined;
  };
}
