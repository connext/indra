import { providers } from "ethers";

import { AppRegistry, DefaultApp, AppInstanceJson } from "./app";
import { Address, Bytes32, DecString, Xpub } from "./basic";
import { ChannelProviderConfig, IChannelProvider, KeyGen } from "./channelProvider";
import { EventNames } from "./events";
import { ILogger, ILoggerService } from "./logger";
import { IMessagingService } from "./messaging";
import {
  GetHashLockTransferResponse,
  GetSignedTransferResponse,
  RebalanceProfile,
  GetChannelResponse,
  CreateChannelResponse,
  GetConfigResponse,
  RequestCollateralResponse,
  TransferInfo,
  GetLinkedTransferResponse,
} from "./node";
import {
  MethodResults,
  MethodParams,
  MethodName,
} from "./methods";
import { IBackupServiceAPI, IClientStore, StoreTypes } from "./store";
import { PublicParams, PublicResults } from "./public";

/////////////////////////////////

// channelProvider, mnemonic, and xpub+keyGen are all optional but one of them needs to be provided
export interface ClientOptions {
  backupService?: IBackupServiceAPI;
  channelProvider?: IChannelProvider;
  ethProviderUrl: string;
  keyGen?: KeyGen;
  mnemonic?: string;
  xpub?: Xpub;
  store?: IClientStore;
  storeType?: StoreTypes;
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
  config: GetConfigResponse;
  channelProvider: IChannelProvider;
  ethProvider: providers.JsonRpcProvider;
  freeBalanceAddress: Address;
  multisigAddress: Address;
  nodePublicIdentifier: Xpub;
  nodeFreeBalanceAddress: Address;
  publicIdentifier: Xpub;

  // Expose some internal machineary for easier debugging
  messaging: IMessagingService;
  store: IClientStore;

  ////////////////////////////////////////
  // Methods

  restart(): Promise<void>;

  ///////////////////////////////////
  // LISTENER METHODS
  on(event: EventNames | MethodName, callback: (...args: any[]) => void): void;
  once(event: EventNames | MethodName, callback: (...args: any[]) => void): void;
  emit(event: EventNames | MethodName, data: any): boolean;
  removeListener(
    event: EventNames | MethodName,
    callback: (...args: any[]) => void,
  ): void;

  ///////////////////////////////////
  // CORE CHANNEL METHODS
  channelProviderConfig(): Promise<ChannelProviderConfig>;
  checkDepositRights(
    params: PublicParams.CheckDepositRights
  ): Promise<PublicResults.CheckDepositRights>;
  conditionalTransfer(
    params: PublicParams.ConditionalTransfer
  ): Promise<PublicResults.ConditionalTransfer>;
  deposit(params: PublicParams.Deposit): Promise<PublicResults.Deposit>;
  requestDepositRights(
    params: PublicParams.RequestDepositRights
  ): Promise<MethodResults.RequestDepositRights>;
  rescindDepositRights(
    params: PublicParams.RescindDepositRights
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
  getChannel(): Promise<GetChannelResponse>;
  getLinkedTransfer(paymentId: Bytes32): Promise<GetLinkedTransferResponse>;
  getHashLockTransfer(lockHash: Bytes32): Promise<GetHashLockTransferResponse>;
  getSignedTransfer(lockHash: Bytes32): Promise<GetSignedTransferResponse>;
  getAppRegistry(
    appDetails?:
      | {
          name: string; // AppNames?
          chainId: number;
        }
      | { appDefinitionAddress: Address },
  ): Promise<AppRegistry | DefaultApp | undefined>;
  getRegisteredAppDetails(appName: string /* AppNames */): DefaultApp;
  createChannel(): Promise<CreateChannelResponse>;
  subscribeToSwapRates(from: Address, to: Address, callback: any): Promise<any>;
  getLatestSwapRate(from: Address, to: Address): Promise<DecString>;
  unsubscribeToSwapRates(from: Address, to: Address): Promise<void>;
  requestCollateral(tokenAddress: Address): Promise<RequestCollateralResponse | void>;
  getRebalanceProfile(assetId?: Address): Promise<RebalanceProfile | undefined>;
  getTransferHistory(): Promise<TransferInfo[]>;
  reclaimPendingAsyncTransfers(): Promise<void>;
  reclaimPendingAsyncTransfer(
    amount: DecString,
    assetId: Address,
    paymentId: Bytes32,
    encryptedPreImage: string,
  ): Promise<PublicResults.ResolveLinkedTransfer>;

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
  proposeInstallApp(
    params: MethodParams.ProposeInstall,
  ): Promise<MethodResults.ProposeInstall>;
  installApp(appIdentityHash: Bytes32): Promise<MethodResults.Install>;
  rejectInstallApp(appIdentityHash: Bytes32): Promise<MethodResults.Uninstall>;
  takeAction(appIdentityHash: Bytes32, action: any): Promise<MethodResults.TakeAction>;
  updateState(appIdentityHash: Bytes32, newState: any): Promise<MethodResults.UpdateState>;
  uninstallApp(appIdentityHash: Bytes32): Promise<MethodResults.Uninstall>;
}
