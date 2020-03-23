import { providers } from "ethers";
import { TransactionResponse } from "ethers/providers";

import { AppRegistry, DefaultApp, AppInstanceJson } from "./app";
import { Address, BigNumber, BigNumberish, Xpub } from "./basic";
import {
  ConditionalTransferParameters,
  ConditionalTransferResponse,
  ResolveConditionParameters,
  ResolveConditionResponse,
  ResolveLinkedTransferResponse,
  SwapParameters,
  WithdrawParameters,
  WithdrawResponse,
  GetHashLockTransferResponse,
} from "./contracts";
import { ChannelProviderConfig, IChannelProvider, KeyGen } from "./channelProvider";
import { EventNames } from "./events";
import { ILogger, ILoggerService } from "./logger";
import { IMessagingService } from "./messaging";
import {
  RebalanceProfile,
  GetChannelResponse,
  CreateChannelResponse,
  ChannelAppSequences,
  GetConfigResponse,
  RequestCollateralResponse,
<<<<<<< HEAD
  TransferInfo,
} from "./node";
import {
  MethodResults,
  MethodParams,
  MethodName,
} from "./methods";
import { IBackupServiceAPI, IClientStore, StoreType } from "./store";

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

export type DepositParameters = {
  amount: BigNumberish;
  assetId: Address;
};

export type RequestDepositRightsParameters = {
  assetId: Address;
}

export type RequestDepositRightsResponse = MethodResults.RequestDepositRights;

export type CheckDepositRightsParameters = RequestDepositRightsParameters;

export type CheckDepositRightsResponse = {
  assetId: Address;
  multisigBalance: BigNumber;
  recipient: Address;
  threshold: BigNumber;
};

export type RescindDepositRightsParameters = RequestDepositRightsParameters;
export type RescindDepositRightsResponse = MethodResults.Deposit;

// Generic transfer types
export type TransferParameters = DepositParameters & {
  recipient: Address;
  meta?: object;
  paymentId?: string;
};

export type WithdrawalResponse = ChannelState & { transaction: TransactionResponse };

/////////////////////////////////
=======
  Transfer,
  GetLinkedTransferResponse,
} from "./node";
import { ProtocolTypes } from "./protocol";
import { IBackupServiceAPI, IClientStore, StoreType } from "./store";
import { CFCoreTypes } from "./cfCore";
import { SwapParameters, WithdrawParameters } from "./apps";
>>>>>>> nats-messaging-refactor

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
  on(event: EventNames | MethodName, callback: (...args: any[]) => void): void;
  once(event: EventNames | MethodName, callback: (...args: any[]) => void): void;
  emit(event: EventNames | MethodName, data: any): boolean;
  removeListener(
    event: EventNames | MethodName,
    callback: (...args: any[]) => void,
  ): void;

  ///////////////////////////////////
  // CORE CHANNEL METHODS
  deposit(params: DepositParameters): Promise<ChannelState>;
  swap(params: SwapParameters): Promise<GetChannelResponse>;
  transfer(params: TransferParameters): Promise<any>;
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
<<<<<<< HEAD
  getLinkedTransfer(paymentId: string): Promise<TransferInfo>;
=======
  getLinkedTransfer(paymentId: string): Promise<GetLinkedTransferResponse>;
>>>>>>> nats-messaging-refactor
  getHashLockTransfer(lockHash: string): Promise<GetHashLockTransferResponse>;
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
  getTransferHistory(): Promise<TransferInfo[]>;
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
    amount: BigNumber,
    assetId: string,
    notifyCounterparty: boolean,
  ): Promise<MethodResults.Deposit>;
  getFreeBalance(assetId?: string): Promise<MethodResults.GetFreeBalanceState>;
  getAppInstances(): Promise<AppInstanceJson[]>;
  getAppInstanceDetails(appInstanceId: string): Promise<MethodResults.GetAppInstanceDetails>;
  getAppState(appInstanceId: string): Promise<MethodResults.GetState>;
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
