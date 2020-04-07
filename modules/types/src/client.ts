import { providers } from "ethers";
import { TransactionResponse } from "ethers/providers";

import { AppRegistry, DefaultApp, AppInstanceJson } from "./app";
import { Address, BigNumber, Bytes32, DecString, Xpub } from "./basic";
import {
  ConditionalTransferParameters,
  ConditionalTransferResponse,
  ResolveConditionParameters,
  ResolveConditionResponse,
  ResolveLinkedTransferResponse,
  SwapParameters,
  SwapResponse,
  WithdrawParameters,
  WithdrawResponse,
  GetHashLockTransferResponse,
  GetSignedTransferResponse,
  DepositParameters,
  DepositResponse,
  LinkedTransferResponse,
} from "./contracts";
import { ChannelProviderConfig, IChannelProvider, KeyGen } from "./channelProvider";
import { EventNames } from "./events";
import { ILogger, ILoggerService } from "./logger";
import { IMessagingService } from "./messaging";
import {
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

export type ChannelState = {
  apps: AppInstanceJson[]; // result of getApps()
  freeBalance: MethodResults.GetFreeBalanceState;
};

/////////////////////////////////
// Client input types

export type AssetAmount = {
  amount: BigNumber;
  assetId: Address;
};

export type RequestDepositRightsParameters = MethodParams.RequestDepositRights;
export type RequestDepositRightsResponse = MethodResults.RequestDepositRights;

export type CheckDepositRightsParameters = {
  assetId?: Address;
};

export type CheckDepositRightsResponse = {
  appIdentityHash: Bytes32;
};

export type RescindDepositRightsParameters = MethodParams.RescindDepositRights;
export type RescindDepositRightsResponse = MethodResults.RescindDepositRights;

// Generic transfer types
export type TransferParameters = MethodParams.Deposit & {
  recipient: Address;
  meta?: object;
  paymentId?: Bytes32;
};

export type WithdrawalResponse = ChannelState & { transaction: TransactionResponse };

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
  deposit(params: DepositParameters): Promise<DepositResponse>;
  swap(params: SwapParameters): Promise<SwapResponse>;
  transfer(params: TransferParameters): Promise<LinkedTransferResponse>;
  withdraw(params: WithdrawParameters): Promise<WithdrawResponse>;
  resolveCondition(params: ResolveConditionParameters): Promise<ResolveConditionResponse>;
  conditionalTransfer(params: ConditionalTransferParameters): Promise<ConditionalTransferResponse>;
  restoreState(): Promise<void>;
  channelProviderConfig(): Promise<ChannelProviderConfig>;
  requestDepositRights(
    params: RequestDepositRightsParameters,
  ): Promise<MethodResults.RequestDepositRights>;
  rescindDepositRights(
    params: RescindDepositRightsParameters,
  ): Promise<RescindDepositRightsResponse>;
  checkDepositRights(params: CheckDepositRightsParameters): Promise<CheckDepositRightsResponse>;

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
  ): Promise<ResolveLinkedTransferResponse>;

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
