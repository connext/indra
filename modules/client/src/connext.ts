import { IMessagingService, MessagingServiceFactory } from "@connext/messaging";
import {
  AppActionBigNumber,
  AppRegistry,
  ChannelState,
  CreateChannelResponse,
  DepositParameters,
  GetChannelResponse,
  GetConfigResponse,
  NodeChannel,
  PaymentProfile,
  RegisteredAppDetails,
  SupportedApplication,
  SupportedNetwork,
  SwapParameters,
  TransferParameters,
  WithdrawParameters,
} from "@connext/types";
import {
  CreateChannelMessage,
  jsonRpcDeserialize,
  MNEMONIC_PATH,
  Node,
  NODE_EVENTS,
} from "@counterfactual/node";
import { Address, AppInstanceInfo, Node as NodeTypes } from "@counterfactual/types";
import "core-js/stable";
import { Contract, providers, Wallet } from "ethers";
import { AddressZero } from "ethers/constants";
import { BigNumber, Network } from "ethers/utils";
import tokenAbi from "human-standard-token-abi";
import "regenerator-runtime/runtime";

import { DepositController } from "./controllers/DepositController";
import { SwapController } from "./controllers/SwapController";
import { TransferController } from "./controllers/TransferController";
import { WithdrawalController } from "./controllers/WithdrawalController";
import { Logger } from "./lib/logger";
import {
  freeBalanceAddressFromXpub,
  logEthFreeBalance,
  publicIdentifierToAddress,
} from "./lib/utils";
import { ConnextListener } from "./listener";
import { NodeApiClient } from "./node";
import { ClientOptions, InternalClientOptions } from "./types";
import { invalidAddress } from "./validation/addresses";
import { falsy, notLessThanOrEqualTo, notPositive } from "./validation/bn";

/**
 * Creates a new client-node connection with node at specified url
 *
 * @param opts The options to instantiate the client with.
 * At a minimum, must contain the nodeUrl and a client signing key or mnemonic
 */

export async function connect(opts: ClientOptions): Promise<ConnextInternal> {
  const { logLevel, ethProviderUrl, mnemonic, natsClusterId, nodeUrl, natsToken, store } = opts;

  // create a new wallet
  const ethProvider = new providers.JsonRpcProvider(ethProviderUrl);
  const wallet = Wallet.fromMnemonic(mnemonic).connect(ethProvider);
  const network = await ethProvider.getNetwork();

  // special case for ganache
  if (network.chainId === 4447) {
    network.name = "ganache";
    // Enforce using provided signer, not via RPC
    ethProvider.getSigner = (addressOrIndex?: string | number): any => {
      throw { code: "UNSUPPORTED_OPERATION" };
    };
  }

  console.log(`Creating messaging service client (logLevel: ${logLevel})`);
  const messagingFactory = new MessagingServiceFactory({
    clusterId: natsClusterId,
    logLevel,
    messagingUrl: nodeUrl,
    token: natsToken,
  });
  const messaging = messagingFactory.createService("messaging");
  await messaging.connect();
  console.log("Messaging service is connected");

  // TODO: we need to pass in the whole store to retain context. Figure out how to do this better
  // Note: added this to the client since this is required for the cf module to work
  await store.set([{ key: MNEMONIC_PATH, value: mnemonic }]);

  // create a new node api instance
  // TODO: use local storage for default key value setting!!
  const nodeConfig = {
    logLevel,
    messaging,
  };
  console.log("creating node client");
  const node: NodeApiClient = new NodeApiClient(nodeConfig);
  console.log("created node client successfully");

  const config = await node.config();
  console.log(`node eth network: ${JSON.stringify(config.ethNetwork)}`);
  node.setNodePublicIdentifier(config.nodePublicIdentifier);

  const appRegistry = await node.appRegistry();

  // create new cfModule to inject into internal instance
  console.log("creating new cf module");
  const cfModule = await Node.create(
    messaging,
    store,
    {
      STORE_KEY_PREFIX: "store",
    }, // TODO: proper config
    ethProvider,
    config.contractAddresses,
  );
  node.setUserPublicIdentifier(cfModule.publicIdentifier);
  console.log("created cf module successfully");

  const signer = await cfModule.signerAddress();
  console.log("cf module signer address: ", signer);

  // TODO: make these types
  const myChannel = await node.getChannel();

  let multisigAddress;
  if (!myChannel) {
    // TODO: make these types
    console.log("no channel detected, creating channel..");
    const creationData = await node.createChannel();
    console.log("created channel, transaction:", creationData.transactionHash);
    const creationEventData: NodeTypes.CreateChannelResult = await new Promise(
      (res: any, rej: any): any => {
        const timer = setTimeout(() => rej("Create channel event not fired within 5s"), 5000);
        cfModule.once(NODE_EVENTS.CREATE_CHANNEL, (data: CreateChannelMessage) => {
          clearTimeout(timer);
          res(data.data);
        });
      },
    );
    console.log("create channel event data:", JSON.stringify(creationEventData, null, 2));
    multisigAddress = creationEventData.multisigAddress;
  } else {
    multisigAddress = myChannel.multisigAddress;
  }

  console.log("multisigAddress: ", multisigAddress);
  // create the new client
  return new ConnextInternal({
    appRegistry,
    cfModule,
    ethProvider,
    messaging,
    multisigAddress,
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

  public swap = async (params: SwapParameters): Promise<NodeChannel> => {
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
    return await this.internal.node.config();
  };

  public getChannel = async (): Promise<GetChannelResponse> => {
    return await this.internal.node.getChannel();
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

  ///////////////////////////////////
  // CF MODULE EASY ACCESS METHODS
  // FIXME: add in rest of methods!

  public getFreeBalance = async (
    assetId: string = AddressZero,
  ): Promise<NodeTypes.GetFreeBalanceStateResult> => {
    return await this.internal.getFreeBalance(assetId);
  };

  // FIXME: remove
  public logEthFreeBalance = (
    assetId: string,
    freeBalance: NodeTypes.GetFreeBalanceStateResult,
    log?: Logger,
  ): void => {
    logEthFreeBalance(assetId, freeBalance, log);
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
  public ethProvider: providers.JsonRpcProvider;
  public node: NodeApiClient;
  public messaging: IMessagingService;
  public multisigAddress: Address;
  public listener: ConnextListener;
  public nodePublicIdentifier: string;
  public freeBalanceAddress: string;
  public appRegistry: AppRegistry;

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

    this.ethProvider = opts.ethProvider;
    this.wallet = opts.wallet;
    this.node = opts.node;
    this.messaging = opts.messaging;

    this.appRegistry = opts.appRegistry;

    this.cfModule = opts.cfModule;
    this.freeBalanceAddress = this.cfModule.freeBalanceAddress;
    this.publicIdentifier = this.cfModule.publicIdentifier;
    this.multisigAddress = this.opts.multisigAddress;
    this.nodePublicIdentifier = this.opts.nodePublicIdentifier;

    this.logger = new Logger("ConnextInternal", opts.logLevel);
    // TODO: fix with bos config!
    console.log("******* setting network context: ", opts.network);
    this.network = opts.network;

    // establish listeners
    this.listener = new ConnextListener(opts.cfModule, this);
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

  public swap = async (params: SwapParameters): Promise<NodeChannel> => {
    return await this.swapController.swap(params);
  };

  public transfer = async (params: TransferParameters): Promise<NodeChannel> => {
    return await this.transferController.transfer(params);
  };

  public withdraw = async (params: WithdrawParameters): Promise<ChannelState> => {
    return await this.withdrawalController.withdraw(params);
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
    assetId: string,
    notifyCounterparty: boolean = false,
  ): Promise<NodeTypes.DepositResult> => {
    const depositAddr = publicIdentifierToAddress(this.cfModule.publicIdentifier);
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

    const depositResponse = await this.cfModule.rpcRouter.dispatch(
      jsonRpcDeserialize({
        id: Date.now(),
        jsonrpc: "2.0",
        method: NodeTypes.RpcMethodName.DEPOSIT,
        params: {
          amount,
          multisigAddress: this.opts.multisigAddress,
          notifyCounterparty,
          tokenAddress: assetId,
        } as NodeTypes.DepositParams,
      }),
    );
    return depositResponse.result.result as NodeTypes.DepositResult;
  };

  // TODO: under what conditions will this fail?
  public getAppInstances = async (): Promise<AppInstanceInfo[]> => {
    const appInstanceResponse = await this.cfModule.rpcRouter.dispatch(
      jsonRpcDeserialize({
        id: Date.now(),
        jsonrpc: "2.0",
        method: NodeTypes.RpcMethodName.GET_APP_INSTANCES,
        params: {} as NodeTypes.GetAppInstancesParams,
      }),
    );

    return appInstanceResponse.result.result.appInstances as AppInstanceInfo[];
  };

  // TODO: under what conditions will this fail?
  public getFreeBalance = async (
    assetId: string = AddressZero,
  ): Promise<NodeTypes.GetFreeBalanceStateResult> => {
    try {
      const freeBalance = await this.cfModule.rpcRouter.dispatch(
        jsonRpcDeserialize({
          id: Date.now(),
          jsonrpc: "2.0",
          method: NodeTypes.RpcMethodName.GET_FREE_BALANCE_STATE,
          params: {
            multisigAddress: this.multisigAddress,
            tokenAddress: assetId,
          },
        }),
      );
      return freeBalance.result.result as NodeTypes.GetFreeBalanceStateResult;
    } catch (e) {
      const error = `No free balance exists for the specified token: ${assetId}`;
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

  public getProposedAppInstanceDetails = async (): Promise<
    NodeTypes.GetProposedAppInstancesResult | undefined
  > => {
    const proposedRes = await this.cfModule.rpcRouter.dispatch(
      jsonRpcDeserialize({
        id: Date.now(),
        jsonrpc: "2.0",
        method: NodeTypes.RpcMethodName.GET_PROPOSED_APP_INSTANCES,
        params: {} as NodeTypes.GetProposedAppInstancesParams,
      }),
    );

    return proposedRes.result.result as NodeTypes.GetProposedAppInstancesResult;
  };

  public getAppInstanceDetails = async (
    appInstanceId: string,
  ): Promise<NodeTypes.GetAppInstanceDetailsResult | undefined> => {
    const err = await this.appNotInstalled(appInstanceId);
    if (err) {
      this.logger.warn(err);
      return undefined;
    }
    const appInstanceResponse = await this.cfModule.rpcRouter.dispatch(
      jsonRpcDeserialize({
        id: Date.now(),
        jsonrpc: "2.0",
        method: NodeTypes.RpcMethodName.GET_APP_INSTANCE_DETAILS,
        params: {
          appInstanceId,
        } as NodeTypes.GetAppInstanceDetailsParams,
      }),
    );

    return appInstanceResponse.result.result as NodeTypes.GetAppInstanceDetailsResult;
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
    const stateResponse = await this.cfModule.rpcRouter.dispatch(
      jsonRpcDeserialize({
        id: Date.now(),
        jsonrpc: "2.0",
        method: NodeTypes.RpcMethodName.GET_STATE,
        params: {
          appInstanceId,
        } as NodeTypes.GetStateParams,
      }),
    );

    return stateResponse.result.result as NodeTypes.GetStateResult;
  };

  public takeAction = async (
    appInstanceId: string,
    action: AppActionBigNumber,
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
    const actionResponse = await this.cfModule.rpcRouter.dispatch(
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

    return actionResponse.result.result as NodeTypes.TakeActionResult;
  };

  // TODO: add validation after arjuns refactor merged
  public proposeInstallVirtualApp = async (
    params: NodeTypes.ProposeInstallVirtualParams,
  ): Promise<NodeTypes.ProposeInstallVirtualResult> => {
    if (
      params.intermediaries[0] !== this.nodePublicIdentifier ||
      params.intermediaries.length !== 1
    ) {
      throw new Error(`Incorrect intermediaries. Expected: ${this.nodePublicIdentifier},
         got ${JSON.stringify(params.intermediaries)}`);
    }

    const actionRes = await this.cfModule.rpcRouter.dispatch(
      jsonRpcDeserialize({
        id: Date.now(),
        jsonrpc: "2.0",
        method: NodeTypes.RpcMethodName.PROPOSE_INSTALL_VIRTUAL,
        params,
      }),
    );

    return actionRes.result.result as NodeTypes.ProposeInstallVirtualResult;
  };

  // TODO: add validation after arjuns refactor merged
  public proposeInstallApp = async (
    params: NodeTypes.ProposeInstallParams,
  ): Promise<NodeTypes.ProposeInstallResult> => {
    const actionRes = await this.cfModule.rpcRouter.dispatch(
      jsonRpcDeserialize({
        id: Date.now(),
        jsonrpc: "2.0",
        method: NodeTypes.RpcMethodName.PROPOSE_INSTALL,
        params,
      }),
    );

    return actionRes.result.result as NodeTypes.ProposeInstallResult;
  };

  public installVirtualApp = async (
    appInstanceId: string,
  ): Promise<NodeTypes.InstallVirtualResult> => {
    // check the app isnt actually installed
    const alreadyInstalled = await this.appInstalled(appInstanceId);
    if (alreadyInstalled) {
      throw new Error(alreadyInstalled);
    }
    const installVirtualResponse = await this.cfModule.rpcRouter.dispatch(
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

    return installVirtualResponse.result.result;
  };

  public installApp = async (appInstanceId: string): Promise<NodeTypes.InstallResult> => {
    // check the app isnt actually installed
    const alreadyInstalled = await this.appInstalled(appInstanceId);
    if (alreadyInstalled) {
      throw new Error(alreadyInstalled);
    }
    const installResponse = await this.cfModule.rpcRouter.dispatch(
      jsonRpcDeserialize({
        id: Date.now(),
        jsonrpc: "2.0",
        method: NodeTypes.RpcMethodName.INSTALL,
        params: {
          appInstanceId,
        } as NodeTypes.InstallParams,
      }),
    );

    return installResponse.result.result;
  };

  public uninstallApp = async (appInstanceId: string): Promise<NodeTypes.UninstallResult> => {
    // check the app is actually installed
    const err = await this.appNotInstalled(appInstanceId);
    if (err) {
      this.logger.error(err);
      throw new Error(err);
    }
    const uninstallResponse = await this.cfModule.rpcRouter.dispatch(
      jsonRpcDeserialize({
        id: Date.now(),
        jsonrpc: "2.0",
        method: NodeTypes.RpcMethodName.UNINSTALL,
        params: {
          appInstanceId,
        },
      }),
    );

    return uninstallResponse.result.result as NodeTypes.UninstallResult;
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
    const uninstallVirtualResponse = await this.cfModule.rpcRouter.dispatch(
      jsonRpcDeserialize({
        id: Date.now(),
        jsonrpc: "2.0",
        method: NodeTypes.RpcMethodName.UNINSTALL_VIRTUAL,
        params: {
          appInstanceId,
          intermediaryIdentifier: this.nodePublicIdentifier,
        } as NodeTypes.UninstallVirtualParams,
      }),
    );

    return uninstallVirtualResponse.result.result as NodeTypes.UninstallVirtualResult;
  };

  public rejectInstallApp = async (appInstanceId: string): Promise<NodeTypes.UninstallResult> => {
    const rejectResponse = await this.cfModule.rpcRouter.dispatch(
      jsonRpcDeserialize({
        id: Date.now(),
        jsonrpc: "2.0",
        method: NodeTypes.RpcMethodName.REJECT_INSTALL,
        params: {
          appInstanceId,
        } as NodeTypes.RejectInstallParams,
      }),
    );

    return rejectResponse.result.result as NodeTypes.RejectInstallResult;
  };

  public rejectInstallVirtualApp = async (
    appInstanceId: string,
  ): Promise<NodeTypes.UninstallVirtualResult> => {
    const rejectResponse = await this.cfModule.rpcRouter.dispatch(
      jsonRpcDeserialize({
        id: Date.now(),
        jsonrpc: "2.0",
        method: NodeTypes.RpcMethodName.REJECT_INSTALL,
        params: {
          appInstanceId,
        } as NodeTypes.RejectInstallParams,
      }),
    );

    return rejectResponse.result.result as NodeTypes.RejectInstallResult;
  };

  // TODO: erc20 support?
  public cfWithdraw = async (
    assetId: string,
    amount: BigNumber,
    recipient: string,
  ): Promise<NodeTypes.UninstallResult> => {
    const freeBalance = await this.getFreeBalance(assetId);
    const preWithdrawalBal = freeBalance[this.freeBalanceAddress];
    const err = [
      notLessThanOrEqualTo(amount, preWithdrawalBal),
      recipient ? invalidAddress(recipient) : null, // check address of asset
    ].filter(falsy)[0];
    if (err) {
      this.logger.error(err);
      throw new Error(err);
    }
    const withdrawalResponse = await this.cfModule.rpcRouter.dispatch(
      jsonRpcDeserialize({
        id: Date.now(),
        jsonrpc: "2.0",
        method: NodeTypes.RpcMethodName.WITHDRAW,
        params: {
          amount,
          multisigAddress: this.multisigAddress,
          recipient,
          tokenAddress: assetId,
        },
      }),
    );

    return withdrawalResponse.result.result;
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

  private appInstalled = async (appInstanceId: string): Promise<string | undefined> => {
    const apps = await this.getAppInstances();
    const app = apps.filter((app: AppInstanceInfo) => app.identityHash === appInstanceId);
    if (app.length > 0) {
      return (
        `App with id ${appInstanceId} is already installed.` +
        `Installed apps: ${JSON.stringify(apps, null, 2)}.`
      );
    }
    return undefined;
  };
}
