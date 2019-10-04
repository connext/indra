import { IMessagingService, MessagingServiceFactory } from "@connext/messaging";
import { ProxyLockService } from "@connext/proxy-lock";
import {
  AppActionBigNumber,
  AppRegistry,
  AppState,
  CFCoreChannel,
  ChannelAppSequences,
  ChannelState,
  ConditionalTransferParameters,
  ConditionalTransferResponse,
  ConnextEvent,
  ConnextEvents,
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
  SolidityValueType,
  SupportedApplication,
  SupportedNetwork,
  SwapParameters,
  TransferParameters,
  WithdrawParameters,
} from "@connext/types";
import MinimumViableMultisig from "@counterfactual/cf-funding-protocol-contracts/expected-build-artifacts/MinimumViableMultisig.json";
import Proxy from "@counterfactual/cf-funding-protocol-contracts/expected-build-artifacts/Proxy.json";
import { Address, AppInstanceInfo, Node as CFCoreTypes } from "@counterfactual/types";
import "core-js/stable";
import EthCrypto from "eth-crypto";
import { Contract, providers, Wallet } from "ethers";
import { AddressZero } from "ethers/constants";
import {
  BigNumber,
  getAddress,
  Interface,
  keccak256,
  Network,
  solidityKeccak256,
} from "ethers/utils";
import { fromMnemonic } from "ethers/utils/hdnode";
import tokenAbi from "human-standard-token-abi";
import "regenerator-runtime/runtime";

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
  xkeysToSortedKthAddresses,
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

  // TODO: we need to pass in the whole store to retain context. Figure out how to do this better
  // Note: added this to the client since this is required for the cf module to work
  // generate extended private key from mnemonic
  const extendedXpriv = fromMnemonic(mnemonic).extendedKey;
  await store.set([{ path: EXTENDED_PRIVATE_KEY_PATH, value: extendedXpriv }], undefined, false);

  // create a new node api instance
  // TODO: use local storage for default key value setting!!
  const nodeApiConfig = {
    logLevel,
    messaging,
  };
  logger.info("creating node api client");
  const node: NodeApiClient = new NodeApiClient(nodeApiConfig);
  logger.info("created node api client successfully");

  const config = await node.config();
  logger.info(`node is connected to eth network: ${JSON.stringify(config.ethNetwork)}`);
  node.setNodePublicIdentifier(config.nodePublicIdentifier);

  const appRegistry = await node.appRegistry();

  // create the lock service for cfCore
  logger.info("using node's proxy lock service");
  const lockService: ProxyLockService = new ProxyLockService(messaging);

  // create new cfCore to inject into internal instance
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
  node.setUserPublicIdentifier(cfCore.publicIdentifier);
  logger.info("created cf module successfully");

  const signer = await cfCore.signerAddress();
  logger.info(`cf module signer address: ${signer}`);

  // TODO: make these types
  const myChannel = await node.getChannel();

  let multisigAddress: string;
  if (!myChannel) {
    // TODO: make these types
    logger.info("no channel detected, creating channel..");
    const creationEventData: CFCoreTypes.CreateChannelResult = await new Promise(
      async (res: any, rej: any): Promise<any> => {
        const timer = setTimeout(() => rej("Create channel event not fired within 30s"), 30000);
        cfCore.once(CFCoreTypes.EventName.CREATE_CHANNEL, (data: CreateChannelMessage) => {
          clearTimeout(timer);
          res(data.data);
        });

        const creationData = await node.createChannel();
        logger.info(`created channel, transaction: ${JSON.stringify(creationData)}`);
      },
    );
    logger.info(`create channel event data: ${JSON.stringify(creationEventData, replaceBN, 2)}`);
    multisigAddress = creationEventData.multisigAddress;
  } else {
    multisigAddress = myChannel.multisigAddress;
  }

  logger.info(`multisigAddress: ${multisigAddress}`);
  // create the new client
  const client = new ConnextInternal({
    appRegistry,
    cfCore,
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

  // TODO: do we want the inputs to be an object?
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

  public restoreState = async (
    mnemonic: string,
    defaultToHub: boolean,
  ): Promise<ConnextInternal> => {
    return await this.internal.restoreState(mnemonic, defaultToHub);
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

  public cfDeposit = async (
    amount: BigNumber,
    assetId: string,
    notifyCounterparty: boolean = false,
  ): Promise<CFCoreTypes.DepositResult> => {
    return await this.internal.cfDeposit(amount, assetId, notifyCounterparty);
  };

  public getFreeBalance = async (
    assetId: string = AddressZero,
  ): Promise<CFCoreTypes.GetFreeBalanceStateResult> => {
    return await this.internal.getFreeBalance(assetId);
  };

  public getAppInstances = async (): Promise<AppInstanceInfo[]> => {
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
  public cfCore: CFCore;
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
    this.appRegistry = opts.appRegistry;
    this.config = opts.config;
    this.ethProvider = opts.ethProvider;
    this.messaging = opts.messaging;
    this.network = opts.network;
    this.node = opts.node;
    this.cfCore = opts.cfCore;
    this.freeBalanceAddress = this.cfCore.freeBalanceAddress;
    this.publicIdentifier = this.cfCore.publicIdentifier;
    this.multisigAddress = this.opts.multisigAddress;
    this.nodePublicIdentifier = this.opts.config.nodePublicIdentifier;
    this.logger = new Logger("ConnextInternal", opts.logLevel);

    // establish listeners
    this.listener = new ConnextListener(opts.cfCore, this);

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

  public restoreStateFromBackup = async (xpub: string): Promise<void> => {
    const restoreStates = await this.opts.store.restore();
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
    await this.opts.store.set([relevantPair], undefined, false);
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
    await this.opts.store.set(actualStates, undefined, false);
  };

  public restoreState = async (
    mnemonic: string,
    defaultToHub: boolean = true,
  ): Promise<ConnextInternal> => {
    const hdNode = fromMnemonic(mnemonic);
    const xpriv = hdNode.extendedKey;
    const xpub = hdNode.derivePath("m/44'/60'/0'/25446").neuter().extendedKey;
    const wallet = new Wallet(hdNode.derivePath("m/44'/60'/0'/25446"));

    // always set the mnemonic in the store
    this.opts.store.reset(wallet);
    await this.opts.store.set(
      [{ path: EXTENDED_PRIVATE_KEY_PATH, value: xpriv }],
      undefined,
      false,
    );

    // try to recover the rest of the stateS
    try {
      await this.restoreStateFromBackup(xpub);
    } catch (e) {
      // failed to restore from pisa, should we default to the hub?
      if (defaultToHub) {
        await this.restoreStateFromNode(xpub);
        this.logger.error(e.message);
      } else throw e;
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
  // CF MODULE METHODS

  public getStateChannel = async (): Promise<{ data: any }> => {
    const params = {
      id: Date.now(),
      methodName: "chan_getStateChannel", // FIXME: CFCoreTypes.RpcMethodName.GET_STATE_CHANNEL,
      parameters: {
        multisigAddress: this.multisigAddress,
      },
    };
    const getStateChannelRes = await this.cfCore.rpcRouter.dispatch(params);
    return getStateChannelRes.result.result;
  };

  public cfDeposit = async (
    amount: BigNumber,
    assetId: string,
    notifyCounterparty: boolean = false,
  ): Promise<CFCoreTypes.DepositResult> => {
    const depositAddr = publicIdentifierToAddress(this.cfCore.publicIdentifier);
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

    const depositResponse = await this.cfCore.rpcRouter.dispatch({
      id: Date.now(),
      methodName: CFCoreTypes.RpcMethodName.DEPOSIT,
      parameters: {
        amount,
        multisigAddress: this.opts.multisigAddress,
        notifyCounterparty,
        tokenAddress: makeChecksum(assetId),
      } as CFCoreTypes.DepositParams,
    });
    return depositResponse.result.result as CFCoreTypes.DepositResult;
  };

  // TODO: under what conditions will this fail?
  public getAppInstances = async (): Promise<AppInstanceInfo[]> => {
    const appInstanceResponse = await this.cfCore.rpcRouter.dispatch({
      id: Date.now(),
      methodName: CFCoreTypes.RpcMethodName.GET_APP_INSTANCES,
      parameters: {} as CFCoreTypes.GetAppInstancesParams,
    });

    return appInstanceResponse.result.result.appInstances as AppInstanceInfo[];
  };

  // TODO: under what conditions will this fail?
  public getFreeBalance = async (
    assetId: string = AddressZero,
  ): Promise<CFCoreTypes.GetFreeBalanceStateResult> => {
    const normalizedAssetId = makeChecksum(assetId);
    try {
      const freeBalance = await this.cfCore.rpcRouter.dispatch({
        id: Date.now(),
        methodName: CFCoreTypes.RpcMethodName.GET_FREE_BALANCE_STATE,
        parameters: {
          multisigAddress: this.multisigAddress,
          tokenAddress: normalizedAssetId,
        },
      });
      return freeBalance.result.result as CFCoreTypes.GetFreeBalanceStateResult;
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
    const proposedRes = await this.cfCore.rpcRouter.dispatch({
      id: Date.now(),
      methodName: CFCoreTypes.RpcMethodName.GET_PROPOSED_APP_INSTANCES,
      parameters: {} as CFCoreTypes.GetProposedAppInstancesParams,
    });
    return proposedRes.result.result as CFCoreTypes.GetProposedAppInstancesResult;
  };

  public getProposedAppInstance = async (
    appInstanceId: string,
  ): Promise<CFCoreTypes.GetProposedAppInstanceResult | undefined> => {
    const proposedRes = await this.cfCore.rpcRouter.dispatch({
      id: Date.now(),
      methodName: CFCoreTypes.RpcMethodName.GET_PROPOSED_APP_INSTANCES,
      parameters: {
        appInstanceId,
      } as CFCoreTypes.GetProposedAppInstancesParams,
    });
    return proposedRes.result.result as CFCoreTypes.GetProposedAppInstanceResult;
  };

  public getAppInstanceDetails = async (
    appInstanceId: string,
  ): Promise<CFCoreTypes.GetAppInstanceDetailsResult | undefined> => {
    const err = await this.appNotInstalled(appInstanceId);
    if (err) {
      this.logger.warn(err);
      return undefined;
    }
    const appInstanceResponse = await this.cfCore.rpcRouter.dispatch({
      id: Date.now(),
      methodName: CFCoreTypes.RpcMethodName.GET_APP_INSTANCE_DETAILS,
      parameters: {
        appInstanceId,
      } as CFCoreTypes.GetAppInstanceDetailsParams,
    });

    return appInstanceResponse.result.result as CFCoreTypes.GetAppInstanceDetailsResult;
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
    const stateResponse = await this.cfCore.rpcRouter.dispatch({
      id: Date.now(),
      methodName: CFCoreTypes.RpcMethodName.GET_STATE,
      parameters: {
        appInstanceId,
      } as CFCoreTypes.GetStateParams,
    });

    return stateResponse.result.result as CFCoreTypes.GetStateResult;
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
    const actionResponse = await this.cfCore.rpcRouter.dispatch({
      id: Date.now(),
      methodName: CFCoreTypes.RpcMethodName.TAKE_ACTION,
      parameters: {
        action,
        appInstanceId,
      } as CFCoreTypes.TakeActionParams,
    });

    return actionResponse.result.result as CFCoreTypes.TakeActionResult;
  };

  public updateState = async (
    appInstanceId: string,
    newState: AppState | SolidityValueType,
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
    const updateResponse = await this.cfCore.rpcRouter.dispatch({
      id: Date.now(),
      methodName: CFCoreTypes.RpcMethodName.UPDATE_STATE,
      parameters: {
        appInstanceId,
        newState,
      } as CFCoreTypes.UpdateStateParams,
    });
    return updateResponse.result.result as CFCoreTypes.UpdateStateResult;
  };

  public proposeInstallVirtualApp = async (
    params: CFCoreTypes.ProposeInstallVirtualParams,
  ): Promise<CFCoreTypes.ProposeInstallVirtualResult> => {
    if (params.intermediaryIdentifier !== this.nodePublicIdentifier) {
      throw new Error(`Cannot install virtual app without node as intermediary`);
    }
    const actionRes = await this.cfCore.rpcRouter.dispatch({
      id: Date.now(),
      methodName: CFCoreTypes.RpcMethodName.PROPOSE_INSTALL_VIRTUAL,
      parameters: params,
    });

    return actionRes.result.result as CFCoreTypes.ProposeInstallResult;
  };

  // TODO: add validation after arjuns refactor merged
  public proposeInstallApp = async (
    params: CFCoreTypes.ProposeInstallParams,
  ): Promise<CFCoreTypes.ProposeInstallResult> => {
    const actionRes = await this.cfCore.rpcRouter.dispatch({
      id: Date.now(),
      methodName: CFCoreTypes.RpcMethodName.PROPOSE_INSTALL,
      parameters: params,
    });

    return actionRes.result.result as CFCoreTypes.ProposeInstallResult;
  };

  public installVirtualApp = async (
    appInstanceId: string,
  ): Promise<CFCoreTypes.InstallVirtualResult> => {
    // check the app isnt actually installed
    const alreadyInstalled = await this.appInstalled(appInstanceId);
    if (alreadyInstalled) {
      throw new Error(alreadyInstalled);
    }
    const installVirtualResponse = await this.cfCore.rpcRouter.dispatch({
      id: Date.now(),
      methodName: CFCoreTypes.RpcMethodName.INSTALL_VIRTUAL,
      parameters: {
        appInstanceId,
        intermediaryIdentifier: this.nodePublicIdentifier,
      } as CFCoreTypes.InstallVirtualParams,
    });

    return installVirtualResponse.result.result;
  };

  public installApp = async (appInstanceId: string): Promise<CFCoreTypes.InstallResult> => {
    // check the app isnt actually installed
    const alreadyInstalled = await this.appInstalled(appInstanceId);
    if (alreadyInstalled) {
      throw new Error(alreadyInstalled);
    }
    const installResponse = await this.cfCore.rpcRouter.dispatch({
      id: Date.now(),
      methodName: CFCoreTypes.RpcMethodName.INSTALL,
      parameters: {
        appInstanceId,
      } as CFCoreTypes.InstallParams,
    });

    return installResponse.result.result;
  };

  public uninstallApp = async (appInstanceId: string): Promise<CFCoreTypes.UninstallResult> => {
    // check the app is actually installed
    const err = await this.appNotInstalled(appInstanceId);
    if (err) {
      this.logger.error(err);
      throw new Error(err);
    }
    const uninstallResponse = await this.cfCore.rpcRouter.dispatch({
      id: Date.now(),
      methodName: CFCoreTypes.RpcMethodName.UNINSTALL,
      parameters: {
        appInstanceId,
      },
    });

    return uninstallResponse.result.result as CFCoreTypes.UninstallResult;
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
    const uninstallVirtualResponse = await this.cfCore.rpcRouter.dispatch({
      id: Date.now(),
      methodName: CFCoreTypes.RpcMethodName.UNINSTALL_VIRTUAL,
      parameters: {
        appInstanceId,
        intermediaryIdentifier: this.nodePublicIdentifier,
      } as CFCoreTypes.UninstallVirtualParams,
    });

    return uninstallVirtualResponse.result.result as CFCoreTypes.UninstallVirtualResult;
  };

  public rejectInstallApp = async (appInstanceId: string): Promise<CFCoreTypes.UninstallResult> => {
    const rejectResponse = await this.cfCore.rpcRouter.dispatch({
      id: Date.now(),
      methodName: CFCoreTypes.RpcMethodName.REJECT_INSTALL,
      parameters: {
        appInstanceId,
      } as CFCoreTypes.RejectInstallParams,
    });

    return rejectResponse.result.result as CFCoreTypes.RejectInstallResult;
  };

  public rejectInstallVirtualApp = async (
    appInstanceId: string,
  ): Promise<CFCoreTypes.UninstallVirtualResult> => {
    const rejectResponse = await this.cfCore.rpcRouter.dispatch({
      id: Date.now(),
      methodName: CFCoreTypes.RpcMethodName.REJECT_INSTALL,
      parameters: {
        appInstanceId,
      } as CFCoreTypes.RejectInstallParams,
    });

    return rejectResponse.result.result as CFCoreTypes.RejectInstallResult;
  };

  public cfWithdraw = async (
    amount: BigNumber,
    assetId?: string,
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
    const withdrawalResponse = await this.cfCore.rpcRouter.dispatch({
      id: Date.now(),
      methodName: CFCoreTypes.RpcMethodName.WITHDRAW,
      parameters: {
        amount,
        multisigAddress: this.multisigAddress,
        recipient,
        tokenAddress: makeChecksumOrEthAddress(assetId),
      },
    });

    return withdrawalResponse.result.result;
  };

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
    const withdrawalResponse = await this.cfCore.rpcRouter.dispatch({
      id: Date.now(),
      methodName: CFCoreTypes.RpcMethodName.WITHDRAW_COMMITMENT,
      parameters: {
        amount,
        multisigAddress: this.multisigAddress,
        recipient,
        tokenAddress: makeChecksumOrEthAddress(assetId),
      } as CFCoreTypes.WithdrawCommitmentParams,
    });

    return withdrawalResponse.result.result;
  };

  ///////////////////////////////////
  // NODE METHODS

  public verifyAppSequenceNumber = async (): Promise<any> => {
    const { data: sc } = await this.getStateChannel();
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

  private appNotInstalled = async (appInstanceId: string): Promise<string | undefined> => {
    const apps = await this.getAppInstances();
    const app = apps.filter((app: AppInstanceInfo) => app.identityHash === appInstanceId);
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
    const app = apps.filter((app: AppInstanceInfo) => app.identityHash === appInstanceId);
    if (app.length > 0) {
      return (
        `App with id ${appInstanceId} is already installed. ` +
        `Installed apps: ${JSON.stringify(apps, replaceBN, 2)}.`
      );
    }
    return undefined;
  };
}
