import { AppInstanceJson, Node as CFCoreTypes } from "@counterfactual/types";
import { BigNumber } from "ethers/utils";

import {
  AppActionBigNumber,
  AppRegistry,
  AppState,
  SupportedApplication,
  SupportedNetwork,
} from "./app";
import { ConnextEvent } from "./basic";
import { CFCoreChannel, ChannelAppSequences, ChannelState, PaymentProfile } from "./channel";
import { ChannelProvider, ChannelProviderConfig } from "./channelProvider";
import {
  ConditionalTransferParameters,
  ConditionalTransferResponse,
  DepositParameters,
  ResolveConditionParameters,
  ResolveConditionResponse,
  ResolveLinkedTransferResponse,
  SwapParameters,
  TransferParameters,
  WithdrawParameters,
} from "./inputs";
import { CreateChannelResponse, GetChannelResponse, GetConfigResponse, Transfer } from "./node";

export interface Store extends CFCoreTypes.IStoreService {
  set(
    pairs: {
      path: string;
      value: any;
    }[],
    shouldBackup?: Boolean,
  ): Promise<void>;
  restore(): Promise<{ path: string; value: any }[]>;
}

export interface ClientOptions {
  // provider, passed through to CF node
  ethProviderUrl: string;
  // node information
  nodeUrl: string; // ws:// or nats:// urls are supported
  // signing options, include either a mnemonic directly
  mnemonic?: string;
  // or a channel provider
  channelProvider?: ChannelProvider;
  // function passed in by wallets to generate ephemeral keys
  // used when signing applications
  keyGen?: () => Promise<string>; // TODO: what will the type look like?
  safeSignHook?: (state: ChannelState | AppState) => Promise<string>;
  store: Store;
  // TODO: state: string?
  logLevel?: number; // see logger.ts for meaning, optional
  // TODO: should be used in internal options? --> only if hardcoded
  // nats communication config, client must provide
  natsClusterId?: string;
  natsToken?: string;
}

/**
 * This interface contains all methods associated with managing
 * or establishing a user's channel.
 */
export interface ConnextClientI {
  ///////////////////////////////////
  // MISC
  config: GetConfigResponse;

  ///////////////////////////////////
  // LISTENER METHODS
  on(event: ConnextEvent | CFCoreTypes.EventName, callback: (...args: any[]) => void): void;
  emit(event: ConnextEvent | CFCoreTypes.EventName, data: any): boolean;

  ///////////////////////////////////
  // CORE CHANNEL METHODS
  deposit(params: DepositParameters): Promise<ChannelState>;
  swap(params: SwapParameters): Promise<CFCoreChannel>;
  transfer(params: TransferParameters): Promise<CFCoreChannel>;
  withdraw(params: WithdrawParameters): Promise<ChannelState>;
  resolveCondition(params: ResolveConditionParameters): Promise<ResolveConditionResponse>;
  conditionalTransfer(params: ConditionalTransferParameters): Promise<ConditionalTransferResponse>;
  restoreState(mnemonic: string): Promise<any>;
  channelProviderConfig(): Promise<ChannelProviderConfig>;

  ///////////////////////////////////
  // NODE EASY ACCESS METHODS
  getChannel(): Promise<GetChannelResponse>;
  getLinkedTransfer(paymentId: string): Promise<any>;
  // TODO: do we really need to expose this?
  getAppRegistry(appDetails?: {
    name: SupportedApplication;
    network: SupportedNetwork;
  }): Promise<AppRegistry>;
  // TODO: do we really need to expose this?
  createChannel(): Promise<CreateChannelResponse>;
  subscribeToSwapRates(from: string, to: string, callback: any): Promise<any>;
  getLatestSwapRate(from: string, to: string): Promise<string>;
  unsubscribeToSwapRates(from: string, to: string): Promise<void>;
  requestCollateral(tokenAddress: string): Promise<void>;
  addPaymentProfile(profile: PaymentProfile): Promise<PaymentProfile>;
  getPaymentProfile(assetId?: string): Promise<PaymentProfile | undefined>;
  getTransferHistory(): Promise<Transfer[]>;
  reclaimPendingAsyncTransfers(): Promise<void>;
  reclaimPendingAsyncTransfer(
    paymentId: string,
    encryptedPreImage: string,
  ): Promise<ResolveLinkedTransferResponse>;
  verifyAppSequenceNumber(): Promise<ChannelAppSequences>;

  ///////////////////////////////////
  // CF MODULE EASY ACCESS METHODS
  providerDeposit(
    amount: BigNumber,
    assetId: string,
    notifyCounterparty: boolean,
  ): Promise<CFCoreTypes.DepositResult>;
  getFreeBalance(assetId: string): Promise<CFCoreTypes.GetFreeBalanceStateResult>;
  getAppInstances(): Promise<AppInstanceJson[]>;
  getAppInstanceDetails(appInstanceId: string): Promise<CFCoreTypes.GetAppInstanceDetailsResult>;
  getAppState(appInstanceId: string): Promise<CFCoreTypes.GetStateResult>;
  getProposedAppInstances(): Promise<CFCoreTypes.GetProposedAppInstancesResult | undefined>;
  getProposedAppInstance(
    appInstanceId: string,
  ): Promise<CFCoreTypes.GetProposedAppInstanceResult | undefined>;
  proposeInstallApp(
    params: CFCoreTypes.ProposeInstallParams,
  ): Promise<CFCoreTypes.ProposeInstallResult>;
  proposeInstallVirtualApp(
    params: CFCoreTypes.ProposeInstallVirtualParams,
  ): Promise<CFCoreTypes.ProposeInstallVirtualResult>;
  installVirtualApp(appInstanceId: string): Promise<CFCoreTypes.InstallVirtualResult>;
  installApp(appInstanceId: string): Promise<CFCoreTypes.InstallResult>;
  rejectInstallApp(appInstanceId: string): Promise<CFCoreTypes.UninstallResult>;
  takeAction(
    appInstanceId: string,
    action: AppActionBigNumber,
  ): Promise<CFCoreTypes.TakeActionResult>;
  updateState(
    appInstanceId: string,
    newState: AppState | any,
  ): Promise<CFCoreTypes.UpdateStateResult>;
  uninstallApp(appInstanceId: string): Promise<CFCoreTypes.UninstallResult>;
  uninstallVirtualApp(appInstanceId: string): Promise<CFCoreTypes.UninstallVirtualResult>;
}
