import { providers } from "ethers";

import { AppRegistry, DefaultApp, AppInstanceJson } from "./app";
import { Address, Bytes32, DecString, PublicIdentifier } from "./basic";
import { ChannelProviderConfig, IChannelProvider } from "./channelProvider";
import { IChannelSigner } from "./crypto";
import { EventName, EventPayload } from "./events";
import { ILogger, ILoggerService } from "./logger";
import { IMessagingService } from "./messaging";
import { NodeResponses } from "./node";
import { MethodResults, MethodParams } from "./methods";
import { IStoreService } from "./store";
import { PublicParams, PublicResults } from "./public";
import { AppAction } from ".";

/////////////////////////////////

// channelProvider / signer are both optional but one of them needs to be provided
// ethProvider and ethProviderUrl are both optional but one of them needs to be provided
export interface ClientOptions {
  channelProvider?: IChannelProvider;
  ethProvider?: providers.JsonRpcProvider;
  ethProviderUrl?: string;
  chainId?: number;
  signer?: string | IChannelSigner;
  store?: IStoreService;
  logger?: ILogger;
  loggerService?: ILoggerService;
  logLevel?: number;
  messaging?: IMessagingService;
  nodeUrl?: string; // node's HTTP endpoint
  messagingUrl?: string; // optional override for messaging endpoint
  skipSync?: boolean;
  skipInitStore?: boolean;
}

export interface IConnextClient {
  ////////////////////////////////////////
  // Properties

  appRegistry: AppRegistry;
  config: NodeResponses.GetConfig;
  channelProvider: IChannelProvider;
  ethProvider: providers.JsonRpcProvider;
  chainId: number;
  signerAddress: Address;
  multisigAddress: Address;
  nodeIdentifier: PublicIdentifier;
  nodeSignerAddress: Address;
  publicIdentifier: PublicIdentifier; // publicIdentifier?

  ////////////////////////////////////////
  // Methods

  restart(): Promise<void>;

  ///////////////////////////////////
  // Core channel methods
  channelProviderConfig(): Promise<ChannelProviderConfig>;
  checkDepositRights(
    params: PublicParams.CheckDepositRights,
  ): Promise<PublicResults.CheckDepositRights>;
  conditionalTransfer(
    params: PublicParams.ConditionalTransfer,
  ): Promise<PublicResults.ConditionalTransfer>;
  deposit(params: PublicParams.Deposit): Promise<PublicResults.Deposit>;
  requestDepositRights(
    params: PublicParams.RequestDepositRights,
  ): Promise<MethodResults.RequestDepositRights>;
  rescindDepositRights(
    params: PublicParams.RescindDepositRights,
  ): Promise<PublicResults.RescindDepositRights>;
  resolveCondition(params: PublicParams.ResolveCondition): Promise<PublicResults.ResolveCondition>;
  restoreState(): Promise<void>;
  swap(params: PublicParams.Swap): Promise<PublicResults.Swap>;
  transfer(params: PublicParams.Transfer): Promise<PublicResults.ConditionalTransfer>;
  withdraw(params: PublicParams.Withdraw): Promise<PublicResults.Withdraw>;

  ///////////////////////////////////
  // Listener methods
  on<T extends EventName>(
    event: T,
    callback: (payload: EventPayload[T]) => void | Promise<void>,
    filter?: (payload: EventPayload[T]) => boolean,
  ): void;
  once<T extends EventName>(
    event: T,
    callback: (payload: EventPayload[T]) => void | Promise<void>,
    filter?: (payload: EventPayload[T]) => boolean,
  ): void;
  waitFor<T extends EventName>(
    event: T,
    timeout: number,
    filter?: (payload: EventPayload[T]) => boolean,
  ): Promise<EventPayload[T]>;
  emit<T extends EventName>(event: T, payload: EventPayload[T]): boolean;
  off(): void;

  ////////////////////////////////////////
  // Expose some internal machineary for easier debugging
  messaging: IMessagingService;
  store: IStoreService;

  ///////////////////////////////////
  // Node easy access methods
  // TODO: do we really need to expose all of these?
  isAvailable(): Promise<void>;
  getChannel(): Promise<NodeResponses.GetChannel>;
  getLinkedTransfer(paymentId: Bytes32): Promise<NodeResponses.GetLinkedTransfer>;
  getHashLockTransfer(
    lockHash: Bytes32,
    assetId?: Address,
  ): Promise<NodeResponses.GetHashLockTransfer>;
  getSignedTransfer(paymentId: Bytes32): Promise<NodeResponses.GetSignedTransfer>;
  getGraphTransfer(paymentId: Bytes32): Promise<NodeResponses.GetSignedTransfer>;
  getAppRegistry(
    appDetails?:
      | {
          name: string; // AppNames?
          chainId: number;
        }
      | { appDefinitionAddress: Address },
  ): Promise<AppRegistry | DefaultApp | undefined>;
  createChannel(): Promise<NodeResponses.CreateChannel>;
  subscribeToSwapRates(from: Address, to: Address, callback: any): Promise<any>;
  getLatestSwapRate(from: Address, to: Address): Promise<DecString>;
  unsubscribeToSwapRates(from: Address, to: Address): Promise<void>;
  requestCollateral(tokenAddress: Address): Promise<PublicResults.RequestCollateral>;
  getRebalanceProfile(assetId?: Address): Promise<NodeResponses.GetRebalanceProfile | undefined>;
  getTransferHistory(): Promise<NodeResponses.GetTransferHistory>;
  reclaimPendingAsyncTransfers(): Promise<void>;

  ///////////////////////////////////
  // CF module easy access methods
  deployMultisig(): Promise<MethodResults.DeployStateDepositHolder>;
  getStateChannel(): Promise<MethodResults.GetStateChannel>;
  getFreeBalance(assetId?: Address): Promise<MethodResults.GetFreeBalanceState>;
  getAppInstances(): Promise<AppInstanceJson[]>;
  getAppInstance(
    appIdentityHash: Bytes32,
  ): Promise<MethodResults.GetAppInstanceDetails | undefined>;
  getProposedAppInstances(
    multisigAddress?: Address,
  ): Promise<MethodResults.GetProposedAppInstances | undefined>;
  getProposedAppInstance(
    appIdentityHash: Bytes32,
  ): Promise<MethodResults.GetProposedAppInstance | undefined>;
  proposeInstallApp(params: MethodParams.ProposeInstall): Promise<MethodResults.ProposeInstall>;
  installApp(appIdentityHash: Bytes32): Promise<MethodResults.Install>;
  rejectInstallApp(appIdentityHash: Bytes32, reason?: string): Promise<MethodResults.Uninstall>;
  takeAction(appIdentityHash: Bytes32, action: any): Promise<MethodResults.TakeAction>;
  uninstallApp(appIdentityHash: Bytes32, action?: AppAction): Promise<MethodResults.Uninstall>;
}
