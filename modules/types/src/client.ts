import { providers } from "ethers";

import { AppRegistry, DefaultApp, AppInstanceJson } from "./app";
import { Address, Bytes32, DecString, PublicIdentifier } from "./basic";
import { ChannelProviderConfig, IChannelProvider } from "./channelProvider";
import { IChannelSigner } from "./crypto";
import { EventNames } from "./events";
import { ILogger, ILoggerService } from "./logger";
import { IMessagingService } from "./messaging";
import { NodeResponses } from "./node";
import { MethodResults, MethodParams, MethodName } from "./methods";
import { IStoreService } from "./store";
import { PublicParams, PublicResults } from "./public";

/////////////////////////////////

// channelProvider / signer are both optional but one of them needs to be provided
export interface ClientOptions {
  channelProvider?: IChannelProvider;
  ethProviderUrl: string;
  signer?: string | IChannelSigner;
  store?: IStoreService;
  logger?: ILogger;
  loggerService?: ILoggerService;
  logLevel?: number;
  messaging?: IMessagingService;
  nodeUrl?: string; // node's HTTP endpoint
  messagingUrl?: string; // optional override for messaging endpoint
}

export interface IConnextClient {
  ////////////////////////////////////////
  // Properties

  appRegistry: AppRegistry;
  config: NodeResponses.GetConfig;
  channelProvider: IChannelProvider;
  ethProvider: providers.JsonRpcProvider;
  signerAddress: Address;
  multisigAddress: Address;
  nodeIdentifier: PublicIdentifier;
  nodeSignerAddress: Address;
  publicIdentifier: PublicIdentifier; // publicIdentifier?

  // Expose some internal machineary for easier debugging
  messaging: IMessagingService;
  store: IStoreService;

  ////////////////////////////////////////
  // Methods

  restart(): Promise<void>;

  ///////////////////////////////////
  // LISTENER METHODS
  on(event: EventNames | MethodName, callback: (...args: any[]) => void): void;
  once(event: EventNames | MethodName, callback: (...args: any[]) => void): void;
  emit(event: EventNames | MethodName, data: any): boolean;
  removeListener(event: EventNames | MethodName, callback: (...args: any[]) => void): void;
  removeAllListeners(event?: EventNames | MethodName): void;

  ///////////////////////////////////
  // CORE CHANNEL METHODS
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
  transfer(params: PublicParams.Transfer): Promise<PublicResults.LinkedTransfer>;
  withdraw(params: PublicParams.Withdraw): Promise<PublicResults.Withdraw>;

  ///////////////////////////////////
  // NODE EASY ACCESS METHODS
  // TODO: do we really need to expose all of these?
  isAvailable(): Promise<void>;
  getChannel(): Promise<NodeResponses.GetChannel>;
  getLinkedTransfer(paymentId: Bytes32): Promise<NodeResponses.GetLinkedTransfer>;
  getHashLockTransfer(
    lockHash: Bytes32,
    assetId?: Address,
  ): Promise<NodeResponses.GetHashLockTransfer>;
  getSignedTransfer(lockHash: Bytes32): Promise<NodeResponses.GetSignedTransfer>;
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
  requestCollateral(tokenAddress: Address): Promise<NodeResponses.RequestCollateral | void>;
  getRebalanceProfile(assetId?: Address): Promise<NodeResponses.GetRebalanceProfile | undefined>;
  getTransferHistory(): Promise<NodeResponses.GetTransferHistory>;
  reclaimPendingAsyncTransfers(): Promise<void>;

  ///////////////////////////////////
  // CF MODULE EASY ACCESS METHODS
  deployMultisig(): Promise<MethodResults.DeployStateDepositHolder>;
  getStateChannel(): Promise<MethodResults.GetStateChannel>;
  getFreeBalance(assetId?: Address): Promise<MethodResults.GetFreeBalanceState>;
  getAppInstances(): Promise<AppInstanceJson[]>;
  getAppInstance(appIdentityHash: Bytes32): Promise<MethodResults.GetAppInstanceDetails>;
  getProposedAppInstances(
    multisigAddress?: Address,
  ): Promise<MethodResults.GetProposedAppInstances | undefined>;
  getProposedAppInstance(
    appIdentityHash: Bytes32,
  ): Promise<MethodResults.GetProposedAppInstance | undefined>;
  proposeInstallApp(params: MethodParams.ProposeInstall): Promise<MethodResults.ProposeInstall>;
  installApp(appIdentityHash: Bytes32): Promise<MethodResults.Install>;
  rejectInstallApp(appIdentityHash: Bytes32): Promise<MethodResults.Uninstall>;
  takeAction(appIdentityHash: Bytes32, action: any): Promise<MethodResults.TakeAction>;
  uninstallApp(appIdentityHash: Bytes32): Promise<MethodResults.Uninstall>;
}
