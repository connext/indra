import { providers, BigNumberish } from "ethers";

import { AppRegistry, DefaultApp, AppInstanceJson } from "./app";
import { Address, Bytes32, DecString, PublicIdentifier } from "./basic";
import { ChannelProviderConfig, IChannelProvider } from "./channelProvider";
import { IChannelSigner } from "./crypto";
import { EventName, EventPayload } from "./events";
import { ILogger, ILoggerService } from "./logger";
import { IMessagingService } from "./messaging";
import { NodeResponses } from "./node";
import { MethodResults as mR, MethodParams as mP } from "./methods";
import { IStoreService } from "./store";
import { MiddlewareMap } from "./middleware";
import { PublicParams as P, PublicResults as R } from "./public";
import { AppAction } from ".";

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
  middlewareMap?: MiddlewareMap;
  messaging?: IMessagingService;
  nodeUrl?: string; // node's HTTP endpoint
  messagingUrl?: string; // optional override for messaging endpoint
  skipSync?: boolean;
  skipInitStore?: boolean;
  watcherEnabled?: boolean;
}

export interface IConnextClient {
  ////////////////////////////////////////
  // Properties
  appRegistry: AppRegistry;
  chainId: number;
  channelProvider: IChannelProvider;
  config: NodeResponses.GetConfig;
  ethProvider: providers.JsonRpcProvider;
  messaging: IMessagingService;
  multisigAddress: Address;
  nodeIdentifier: PublicIdentifier;
  nodeSignerAddress: Address;
  publicIdentifier: PublicIdentifier; // publicIdentifier?
  signerAddress: Address;
  store: IStoreService;

  ///////////////////////////////////
  // High-level channel methods
  conditionalTransfer(params: P.ConditionalTransfer): Promise<R.ConditionalTransfer>;
  deposit(params: P.Deposit): Promise<R.Deposit>;
  resolveCondition(params: P.ResolveCondition): Promise<R.ResolveCondition>;
  swap(params: P.Swap): Promise<R.Swap>;
  transfer(params: P.Transfer): Promise<R.ConditionalTransfer>;
  withdraw(params: P.Withdraw): Promise<R.Withdraw>;

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

  ///////////////////////////////////
  // Low-level channel methods
  channelProviderConfig(): Promise<ChannelProviderConfig>;
  checkDepositRights(params: P.CheckDepositRights): Promise<R.CheckDepositRights>;
  requestDepositRights(params: P.RequestDepositRights): Promise<R.RequestDepositRights>;
  rescindDepositRights(params: P.RescindDepositRights): Promise<R.RescindDepositRights>;
  restart(): Promise<void>;
  restoreState(): Promise<void>;

  ///////////////////////////////////
  // Dispute methods
  initiateChallenge(params: P.InitiateChallenge): Promise<R.InitiateChallenge>;
  cancelChallenge(params: P.CancelChallenge): Promise<R.CancelChallenge>;

  ///////////////////////////////////
  // Node easy access methods
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
  requestCollateral(tokenAddress: Address, amount?: BigNumberish): Promise<R.RequestCollateral>;
  getRebalanceProfile(assetId?: Address): Promise<NodeResponses.GetRebalanceProfile | undefined>;
  getTransferHistory(): Promise<NodeResponses.GetTransferHistory>;
  reclaimPendingAsyncTransfers(): Promise<void>;

  ///////////////////////////////////
  // CF module easy access methods
  deployMultisig(): Promise<mR.DeployStateDepositHolder>;
  getStateChannel(): Promise<mR.GetStateChannel>;
  getFreeBalance(assetId?: Address): Promise<mR.GetFreeBalanceState>;
  getAppInstances(): Promise<AppInstanceJson[]>;
  getAppInstance(appIdentityHash: Bytes32): Promise<mR.GetAppInstanceDetails | undefined>;
  getProposedAppInstances(
    multisigAddress?: Address,
  ): Promise<mR.GetProposedAppInstances | undefined>;
  getProposedAppInstance(appIdentityHash: Bytes32): Promise<mR.GetProposedAppInstance | undefined>;
  proposeInstallApp(params: mP.ProposeInstall): Promise<mR.ProposeInstall>;
  installApp(appIdentityHash: Bytes32): Promise<mR.Install>;
  rejectInstallApp(appIdentityHash: Bytes32, reason?: string): Promise<mR.Uninstall>;
  takeAction(appIdentityHash: Bytes32, action: any): Promise<mR.TakeAction>;
  uninstallApp(appIdentityHash: Bytes32, action?: AppAction): Promise<mR.Uninstall>;
}
