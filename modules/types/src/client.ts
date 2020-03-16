import { providers } from "ethers";
import { TransactionResponse } from "ethers/providers";

import { AppRegistry, DefaultApp, AppInstanceJson } from "./app";
import { Address, DecString, Xpub } from "./basic";
import {
  ConditionalTransferParameters,
  ConditionalTransferResponse,
  ResolveConditionParameters,
  ResolveConditionResponse,
  ResolveLinkedTransferResponse,
  SwapParameters,
} from "./contracts";
import { ChannelProviderConfig, IChannelProvider, KeyGen } from "./channelProvider";
import { EventName } from "./events";
import { ILogger, ILoggerService } from "./logger";
import { IMessagingService } from "./messaging";
import {
  RebalanceProfile,
  GetChannelResponse,
  CreateChannelResponse,
  ChannelAppSequences,
  GetConfigResponse,
  RequestCollateralResponse,
  Transfer,
} from "./node";
import {
  MethodResults,
  MethodParams,
  MethodName,
} from "./methods";
import { IBackupServiceAPI, IClientStore, StoreType, WithdrawalMonitorObject } from "./store";

export type ChannelState = {
  apps: AppInstanceJson[]; // result of getApps()
  freeBalance: MethodResults.GetFreeBalanceState;
};

/////////////////////////////////
// Client input types

export type AssetAmount = {
  amount: DecString;
  assetId: Address;
};

export type DepositParameters = {
  amount: DecString;
  assetId: Address;
};

export type RequestDepositRightsParameters = {
  assetId: Address;
}

export type RequestDepositRightsResponse = MethodResults.RequestDepositRights;

export type CheckDepositRightsParameters = MethodParams.RequestDepositRights;

export type CheckDepositRightsResponse = {
  assetId: Address;
  multisigBalance: DecString;
  recipient: Address;
  threshold: DecString;
};

export type RescindDepositRightsParameters = MethodParams.RequestDepositRights;
export type RescindDepositRightsResponse = MethodResults.Deposit;

// Withdraw types
export type WithdrawParameters = MethodParams.Deposit & {
  userSubmitted?: boolean;
  recipient?: Address; // if not provided, will default to signer addr
};

// Generic transfer types
export type TransferParameters = MethodParams.Deposit & {
  recipient: Address;
  meta?: object;
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
  xpub?: string;
  store?: IClientStore;
  storeType?: StoreType;
  logger?: ILogger;
  loggerService?: ILoggerService;
  logLevel?: number;
  messaging?: IMessagingService;
  nodeUrl?: string; // ws:// or nats:// urls are supported
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
  publicIdentifier: Xpub;
  signerAddress: Address;

  // Expose some internal machineary for easier debugging
  messaging: IMessagingService;
  store: IClientStore;

  ////////////////////////////////////////
  // Methods

  restart(): Promise<void>;

  ///////////////////////////////////
  // LISTENER METHODS
  on(event: EventName | MethodName, callback: (...args: any[]) => void): void;
  once(event: EventName | MethodName, callback: (...args: any[]) => void): void;
  emit(event: EventName | MethodName, data: any): boolean;
  removeListener(
    event: EventName | MethodName,
    callback: (...args: any[]) => void,
  ): void;

  ///////////////////////////////////
  // CORE CHANNEL METHODS
  deposit(params: DepositParameters): Promise<ChannelState>;
  swap(params: SwapParameters): Promise<GetChannelResponse>;
  transfer(params: TransferParameters): Promise<any>;
  withdraw(params: WithdrawParameters): Promise<ChannelState>;
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
  getLinkedTransfer(paymentId: string): Promise<Transfer>;
  getAppRegistry(
    appDetails?:
      | {
          name: string;
          chainId: number;
        }
      | { appDefinitionAddress: string },
  ): Promise<AppRegistry>;
  getRegisteredAppDetails(appName: string): DefaultApp;
  createChannel(): Promise<CreateChannelResponse>;
  subscribeToSwapRates(from: string, to: string, callback: any): Promise<any>;
  getLatestSwapRate(from: string, to: string): Promise<string>;
  unsubscribeToSwapRates(from: string, to: string): Promise<void>;
  requestCollateral(tokenAddress: string): Promise<RequestCollateralResponse | void>;
  getRebalanceProfile(assetId?: string): Promise<RebalanceProfile | undefined>;
  getTransferHistory(): Promise<Transfer[]>;
  reclaimPendingAsyncTransfers(): Promise<void>;
  reclaimPendingAsyncTransfer(
    amount: string,
    assetId: string,
    paymentId: string,
    encryptedPreImage: string,
  ): Promise<ResolveLinkedTransferResponse>;
  verifyAppSequenceNumber(): Promise<ChannelAppSequences>;

  ///////////////////////////////////
  // CF MODULE EASY ACCESS METHODS
  deployMultisig(): Promise<MethodResults.DeployStateDepositHolder>;
  getStateChannel(): Promise<MethodResults.GetStateChannel>;
  providerDeposit(
    amount: DecString,
    assetId: string,
    notifyCounterparty: boolean,
  ): Promise<MethodResults.Deposit>;
  getFreeBalance(assetId?: string): Promise<MethodResults.GetFreeBalanceState>;
  getAppInstances(): Promise<AppInstanceJson[]>;
  getAppInstanceDetails(appInstanceId: string): Promise<MethodResults.GetAppInstanceDetails>;
  getAppState(appInstanceId: string): Promise<MethodResults.GetState>;
  getLatestNodeSubmittedWithdrawal(): Promise<WithdrawalMonitorObject>;
  getProposedAppInstances(
    multisigAddress?: string,
  ): Promise<MethodResults.GetProposedAppInstances | undefined>;
  getProposedAppInstance(
    appInstanceId: string,
  ): Promise<MethodResults.GetProposedAppInstance | undefined>;
  proposeInstallApp(
    params: MethodParams.ProposeInstall,
  ): Promise<MethodResults.ProposeInstall>;
  installApp(appInstanceId: string): Promise<MethodResults.Install>;
  rejectInstallApp(appInstanceId: string): Promise<MethodResults.Uninstall>;
  takeAction(appInstanceId: string, action: any): Promise<MethodResults.TakeAction>;
  updateState(appInstanceId: string, newState: any): Promise<MethodResults.UpdateState>;
  uninstallApp(appInstanceId: string): Promise<MethodResults.Uninstall>;
}
