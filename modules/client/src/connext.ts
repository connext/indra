import { IMessagingService, MessagingServiceFactory } from "@connext/messaging";
import {
  AppActionBigNumber,
  AppRegistry,
  AppState,
  ChannelAppSequences,
  AppStateBigNumber,
  ChannelState,
  ConditionalTransferParameters,
  ConditionalTransferResponse,
  CreateChannelResponse,
  DepositParameters,
  GetChannelResponse,
  GetConfigResponse,
  makeChecksum,
  makeChecksumOrEthAddress,
  NodeChannel,
  PaymentProfile,
  RegisteredAppDetails,
  ResolveConditionParameters,
  ResolveConditionResponse,
  SupportedApplication,
  SupportedNetwork,
  SwapParameters,
  TransferParameters,
  WithdrawParameters,
} from "@connext/types";
import {
  CreateChannelMessage,
  EXTENDED_PRIVATE_KEY_PATH,
  Node,
  NODE_EVENTS,
} from "@counterfactual/node";
import { Address, AppInstanceInfo, Node as NodeTypes, AppInstanceJson } from "@counterfactual/types";
import "core-js/stable";
import { Contract, providers } from "ethers";
import { AddressZero } from "ethers/constants";
import { BigNumber, HDNode, Network } from "ethers/utils";
import tokenAbi from "human-standard-token-abi";
import "regenerator-runtime/runtime";

import { ChannelRouter, RpcType } from "./channelRouter";
import { ConditionalTransferController } from "./controllers/ConditionalTransferController";
import { DepositController } from "./controllers/DepositController";
import { ResolveConditionController } from "./controllers/ResolveConditionController";
import { SwapController } from "./controllers/SwapController";
import { TransferController } from "./controllers/TransferController";
import { WithdrawalController } from "./controllers/WithdrawalController";
import { Logger } from "./lib/logger";
import { freeBalanceAddressFromXpub, publicIdentifierToAddress, replaceBN } from "./lib/utils";
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

  logger.info(`Creating messaging service client (logLevel: ${logLevel})`);
  const messagingFactory = new MessagingServiceFactory({
    clusterId: natsClusterId,
    logLevel,
    messagingUrl: nodeUrl,
    token: natsToken,
  });
  const messaging = messagingFactory.createService("messaging");
  await messaging.connect();
  logger.info("Messaging service is connected");

  // create a new node api instance
  // TODO: use local storage for default key value setting!!
  const nodeConfig = {
    logLevel,
    messaging,
  };
  logger.info("creating node client");
  const node: NodeApiClient = new NodeApiClient(nodeConfig);
  logger.info("created node client successfully");

  const config = await node.config();
  logger.info(`node eth network: ${JSON.stringify(config.ethNetwork)}`);
  node.setNodePublicIdentifier(config.nodePublicIdentifier);

  const appRegistry = await node.appRegistry();

  let channelRouter: ChannelRouter;
  let multisigAddress: string;
  if (channelProvider) {
    // FIXME: many of the node methods need the user xpub for the route
    // we will need some way for the channel provider to provide this
    // to properly communicate with the hub
    channelRouter = new ChannelRouter(RpcType.ChannelProvider, channelProvider!);
    node.setUserPublicIdentifier(channelProvider!.publicIdentifier);
    const myChannel = await node.getChannel();
    if (!myChannel) {
      throw new Error(
        `Expected channel to exist when instantiating client with a channel provider.`,
      );
    }
    multisigAddress = myChannel.multisigAddress;
  } else if (mnemonic) {
    // TODO: we need to pass in the whole store to retain context. Figure out how to do this better
    // Note: added this to the client since this is required for the cf module to work
    // generate extended private key from mnemonic
    const extendedXpriv = HDNode.fromMnemonic(mnemonic).extendedKey;
    await store.set([{ path: EXTENDED_PRIVATE_KEY_PATH, value: extendedXpriv }]);
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
    channelRouter = new ChannelRouter(RpcType.CounterfactualNode, cfModule);

    // if instantiating client with cf, cannot assume that there
    // is already an established channel
    const myChannel = await node.getChannel();
    if (!myChannel) {
      // TODO: Deploy at withdraw - otherwise, every single wallet will deploy
      //       for every single user when they come online. Yikes.
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
    }
  } else {
    throw new Error("Must provide either a channelProvider or mnemonic upon instantiation")
  }

  logger.info(`multisigAddress: ${multisigAddress}`);
  // create the new client
  const client = new ConnextInternal({
    appRegistry,
    channelRouter,
    ethProvider,
    messaging,
    multisigAddress,
    network,
    node,
    nodePublicIdentifier: config.nodePublicIdentifier,
    ...opts, // use any provided opts by default
  });
  await client.registerSubscriptions();
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

  public getPaymentProfile = async (assetId?: string): Promise<PaymentProfile | undefined> => {
    return await this.internal.node.getPaymentProfile(assetId);
  };

  // does not directly call node function because needs to send
  // some additional information along with the request, as implemented in
  // ConnextInternal
  public verifyAppSequenceNumber = async (): Promise<ChannelAppSequences> => {
    return await this.internal.verifyAppSequenceNumber();
  };

  ///////////////////////////////////
  // CF MODULE EASY ACCESS METHODS

  public cfDeposit = async (
    amount: BigNumber,
    assetId: string,
    notifyCounterparty: boolean = false,
  ): Promise<NodeTypes.DepositResult> => {
    return await this.internal.cfDeposit(amount, assetId, notifyCounterparty);
  };

  public getFreeBalance = async (
    assetId: string = AddressZero,
  ): Promise<NodeTypes.GetFreeBalanceStateResult> => {
    return await this.internal.getFreeBalance(assetId);
  };

  public getAppInstances = async (): Promise<AppInstanceJson[]> => {
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

  public getProposedAppInstances = async (): Promise<
    NodeTypes.GetProposedAppInstancesResult | undefined
  > => {
    return await this.internal.getProposedAppInstances();
  };

  public getProposedAppInstance = async (
    appInstanceId: string,
  ): Promise<NodeTypes.GetProposedAppInstanceResult | undefined> => {
    return await this.internal.getProposedAppInstance(appInstanceId);
  };

  public proposeInstallApp = async (
    params: NodeTypes.ProposeInstallParams,
  ): Promise<NodeTypes.ProposeInstallResult> => {
    return await this.internal.proposeInstallApp(params);
  };

  public proposeInstallVirtualApp = async (
    params: NodeTypes.ProposeInstallVirtualParams,
  ): Promise<NodeTypes.ProposeInstallVirtualResult> => {
    return await this.internal.proposeInstallVirtualApp(params);
  };

  public installVirtualApp = async (
    appInstanceId: string,
  ): Promise<NodeTypes.InstallVirtualResult> => {
    return await this.internal.installVirtualApp(appInstanceId);
  };

  public installApp = async (appInstanceId: string): Promise<NodeTypes.InstallResult> => {
    return await this.internal.installApp(appInstanceId);
  };

  public rejectInstallApp = async (appInstanceId: string): Promise<NodeTypes.UninstallResult> => {
    return await this.internal.rejectInstallApp(appInstanceId);
  };

  public rejectInstallVirtualApp = async (
    appInstanceId: string,
  ): Promise<NodeTypes.UninstallVirtualResult> => {
    return await this.internal.rejectInstallVirtualApp(appInstanceId);
  };

  public takeAction = async (
    appInstanceId: string,
    action: AppActionBigNumber,
  ): Promise<NodeTypes.TakeActionResult> => {
    return await this.internal.takeAction(appInstanceId, action);
  };

  public updateState = async (
    appInstanceId: string,
    newState: AppState | any, // cast to any bc no supported apps use
    // the update state method
  ): Promise<NodeTypes.UpdateStateResult> => {
    return await this.updateState(appInstanceId, newState);
  };

  public uninstallApp = async (appInstanceId: string): Promise<NodeTypes.UninstallResult> => {
    return await this.uninstallApp(appInstanceId);
  };

  public uninstallVirtualApp = async (
    appInstanceId: string,
  ): Promise<NodeTypes.UninstallVirtualResult> => {
    return await this.internal.uninstallVirtualApp(appInstanceId);
  };

  public cfWithdraw = async (
    amount: BigNumber,
    assetId?: string,
    recipient?: string,
  ): Promise<NodeTypes.WithdrawResult> => {
    return await this.internal.cfWithdraw(amount, assetId, recipient);
  };
}

/**
 * True implementation of the connext client
 */
export class ConnextInternal extends ConnextChannel {
  public opts: InternalClientOptions;
  public channelRouter: ChannelRouter;
  public publicIdentifier: string;
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
  private conditionalTransferController: ConditionalTransferController;
  private resolveConditionController: ResolveConditionController;

  constructor(opts: InternalClientOptions) {
    super(opts);

    this.opts = opts;

    this.ethProvider = opts.ethProvider;
    this.node = opts.node;
    this.messaging = opts.messaging;

    this.appRegistry = opts.appRegistry;

    this.channelRouter = opts.channelRouter;
    this.freeBalanceAddress = this.channelRouter.freeBalanceAddress;
    this.publicIdentifier = this.channelRouter.publicIdentifier;
    this.multisigAddress = this.opts.multisigAddress;
    this.nodePublicIdentifier = this.opts.nodePublicIdentifier;

    this.logger = new Logger("ConnextInternal", opts.logLevel);
    this.network = opts.network;

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

  public swap = async (params: SwapParameters): Promise<NodeChannel> => {
    return await this.swapController.swap(params);
  };

  public transfer = async (params: TransferParameters): Promise<NodeChannel> => {
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

  ///////////////////////////////////
  // EVENT METHODS

  public on = (event: NodeTypes.EventName, callback: (...args: any[]) => void): ConnextListener => {
    return this.listener.on(event, callback);
  };

  public emit = (event: NodeTypes.EventName, data: any): boolean => {
    return this.listener.emit(event, data);
  };

  ///////////////////////////////////
  // PROVIDER/ROUTER METHODS

  // FIXME: add into router!!!
  // public getStateChannel = async (): Promise<{ data: any }> => {
  //   const params = {
  //     id: Date.now(),
  //     methodName: "chan_getStateChannel", // FIXME: NodeTypes.RpcMethodName.GET_STATE_CHANNEL,
  //     parameters: {
  //       multisigAddress: this.multisigAddress,
  //     },
  //   };
  //   const getStateChannelRes = await this.channelRouter.rpcRouter.dispatch(params);
  //   return getStateChannelRes.result.result;
  // };

  public providerDeposit = async (
    amount: BigNumber,
    assetId: string,
    notifyCounterparty: boolean = false,
  ): Promise<NodeTypes.DepositResult> => {
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
    return (await this.channelRouter.getAppInstances()).appInstances;
  };

  // TODO: under what conditions will this fail?
  public getFreeBalance = async (
    assetId: string = AddressZero,
  ): Promise<NodeTypes.GetFreeBalanceStateResult> => {
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
    NodeTypes.GetProposedAppInstancesResult | undefined
  > => {
    return await this.channelRouter.getProposedAppInstances();
  };

  public getProposedAppInstance = async (
    appInstanceId: string,
  ): Promise<NodeTypes.GetProposedAppInstanceResult | undefined> => {
    return await this.channelRouter.getProposedAppInstance(appInstanceId);
  };

  public getAppInstanceDetails = async (
    appInstanceId: string,
  ): Promise<NodeTypes.GetAppInstanceDetailsResult | undefined> => {
    const err = await this.appNotInstalled(appInstanceId);
    if (err) {
      this.logger.warn(err);
      return undefined;
    }

    return await this.channelRouter.getAppInstanceDetails(appInstanceId);
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

    return await this.channelRouter.getAppState(appInstanceId);
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

    return await this.channelRouter.takeAction(appInstanceId, action);
  };

  public updateState = async (
    appInstanceId: string,
    newState: AppStateBigNumber | any, // cast to any bc no supported apps use
    // the update state method
  ): Promise<NodeTypes.UpdateStateResult> => {
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

    return await this.channelRouter.updateState(appInstanceId, newState);
  };

  // TODO: add validation after arjuns refactor merged
  public proposeInstallVirtualApp = async (
    params: NodeTypes.ProposeInstallVirtualParams,
  ): Promise<NodeTypes.ProposeInstallVirtualResult> => {
    this.logger.info(`Proposing install with params: ${JSON.stringify(params, replaceBN, 2)}`);
    if (params.intermediaryIdentifier !== this.nodePublicIdentifier) {
      throw new Error(`Incorrect intermediaryIdentifier. Expected: ${this.nodePublicIdentifier},
         got ${params.intermediaryIdentifier}`);
    }

    return await this.channelRouter.proposeInstallVirtualApp(params);
  };

  public proposeInstallApp = async (
    params: NodeTypes.ProposeInstallParams,
  ): Promise<NodeTypes.ProposeInstallResult> => {
    return await this.channelRouter.proposeInstallApp(params);
  };

  public installVirtualApp = async (
    appInstanceId: string,
  ): Promise<NodeTypes.InstallVirtualResult> => {
    // check the app isnt actually installed
    const alreadyInstalled = await this.appInstalled(appInstanceId);
    if (alreadyInstalled) {
      throw new Error(alreadyInstalled);
    }

    return await this.channelRouter.installVirtualApp(appInstanceId, [
      this.nodePublicIdentifier,
    ]);
  };

  public installApp = async (appInstanceId: string): Promise<NodeTypes.InstallResult> => {
    // check the app isnt actually installed
    const alreadyInstalled = await this.appInstalled(appInstanceId);
    if (alreadyInstalled) {
      throw new Error(alreadyInstalled);
    }

    return await this.channelRouter.installApp(appInstanceId);
  };

  public uninstallApp = async (appInstanceId: string): Promise<NodeTypes.UninstallResult> => {
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
  ): Promise<NodeTypes.UninstallVirtualResult> => {
    // check the app is actually installed
    const err = await this.appNotInstalled(appInstanceId);
    if (err) {
      this.logger.error(err);
      throw new Error(err);
    }

    return await this.channelRouter.uninstallVirtualApp(
      appInstanceId,
      this.nodePublicIdentifier,
    );
  };

  public rejectInstallApp = async (appInstanceId: string): Promise<NodeTypes.UninstallResult> => {
    return await this.channelRouter.rejectInstallApp(appInstanceId);
  };

  public providerWithdraw = async (
    assetId: string,
    amount: BigNumber,
    recipient?: string,
  ): Promise<NodeTypes.WithdrawResult> => {
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

    return await this.channelRouter.withdraw(
      amount,
      this.multisigAddress,
      assetId,
      recipient,
    );
  };

  // FIXME: add to channel provider!!!
  // public cfWithdrawCommitment = async (
  //   amount: BigNumber,
  //   assetId?: string,
  //   recipient?: string,
  // ): Promise<NodeTypes.WithdrawCommitmentResult> => {
  //   const freeBalance = await this.getFreeBalance(assetId);
  //   const preWithdrawalBal = freeBalance[this.freeBalanceAddress];
  //   const err = [
  //     notLessThanOrEqualTo(amount, preWithdrawalBal),
  //     assetId ? invalidAddress(assetId) : null,
  //     recipient ? invalidAddress(recipient) : null,
  //   ].filter(falsy)[0];
  //   if (err) {
  //     this.logger.error(err);
  //     throw new Error(err);
  //   }
  //   const withdrawalResponse = await this.cfModule.rpcRouter.dispatch({
  //     id: Date.now(),
  //     methodName: NodeTypes.RpcMethodName.WITHDRAW_COMMITMENT,
  //     parameters: {
  //       amount,
  //       multisigAddress: this.multisigAddress,
  //       recipient,
  //       tokenAddress: makeChecksumOrEthAddress(assetId),
  //     } as NodeTypes.WithdrawCommitmentParams,
  //   });

  //   return withdrawalResponse.result.result;
  // };

  ///////////////////////////////////
  // NODE METHODS

  public verifyAppSequenceNumber = async (): Promise<any> => {
    // FIXME: add `getStateChannel` to router!!!!!!
    // const { data: sc } = await this.getStateChannel();
    const { data: sc } = { data: { mostRecentlyInstalledAppInstance: (): any => {} } }
    let appSequenceNumber;
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
}
