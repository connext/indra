import { BigNumber } from "ethers/utils";

import {
  AppActionBigNumber,
  AppRegistry,
  AppState,
  SupportedApplication,
  SupportedNetwork,
} from "./app";
import { ConnextEvent } from "./basic";
import { AppInstanceJson, CFCoreTypes } from "./cf";
import { CFCoreChannel, ChannelAppSequences, ChannelState, PaymentProfile } from "./channel";
import { ChannelProvider, ChannelProviderConfig } from "./channelProvider";
import {
  CheckDepositRightsParameters,
  CheckDepositRightsResponse,
  ConditionalTransferParameters,
  ConditionalTransferResponse,
  DepositParameters,
  RequestDepositRightsParameters,
  RescindDepositRightsParameters,
  RescindDepositRightsResponse,
  ResolveConditionParameters,
  ResolveConditionResponse,
  ResolveLinkedTransferResponse,
  SwapParameters,
  TransferParameters,
  WithdrawParameters,
} from "./inputs";
import {
  CreateChannelResponse,
  GetChannelResponse,
  GetConfigResponse,
  RequestCollateralResponse,
  Transfer,
} from "./node";

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

// channelProvider, mnemonic, and xpub+keyGen are all optional but one of them needs to be provided
export interface ClientOptions {
  ethProviderUrl: string;
  nodeUrl: string; // ws:// or nats:// urls are supported
  channelProvider?: ChannelProvider;
  keyGen?: (index: string) => Promise<string>;
  mnemonic?: string;
  xpub?: string;
  store: Store;
  logLevel?: number;
}

export interface IConnextClient {
  ////////////////////////////////////////
  // Properties

  config: GetConfigResponse;
  freeBalanceAddress: string;
  multisigAddress: string;
  nodePublicIdentifier: string;
  publicIdentifier: string;

  ////////////////////////////////////////
  // Methods

  isAvailable: () => Promise<void>;
  restart(): Promise<void>;

  ///////////////////////////////////
  // LISTENER METHODS
  on(event: ConnextEvent | CFCoreTypes.EventName, callback: (...args: any[]) => void): void;
  emit(event: ConnextEvent | CFCoreTypes.EventName, data: any): boolean;

  ///////////////////////////////////
  // CORE CHANNEL METHODS
  deposit(params: DepositParameters): Promise<ChannelState>;
  swap(params: SwapParameters): Promise<CFCoreChannel>;
  transfer(params: TransferParameters): Promise<ConditionalTransferResponse>;
  withdraw(params: WithdrawParameters): Promise<ChannelState>;
  resolveCondition(params: ResolveConditionParameters): Promise<ResolveConditionResponse>;
  conditionalTransfer(params: ConditionalTransferParameters): Promise<ConditionalTransferResponse>;
  restoreState(): Promise<void>;
  channelProviderConfig(): Promise<ChannelProviderConfig>;
  requestDepositRights(
    params: RequestDepositRightsParameters,
  ): Promise<CFCoreTypes.RequestDepositRightsResult>;
  rescindDepositRights(
    params: RescindDepositRightsParameters,
  ): Promise<RescindDepositRightsResponse>;
  checkDepositRights(params: CheckDepositRightsParameters): Promise<CheckDepositRightsResponse>;

  ///////////////////////////////////
  // NODE EASY ACCESS METHODS
  // TODO: do we really need to expose all of these?
  getChannel(): Promise<GetChannelResponse>;
  getLinkedTransfer(paymentId: string): Promise<any>;
  getAppRegistry(appDetails?: {
    name: SupportedApplication;
    network: SupportedNetwork;
  }): Promise<AppRegistry>;
  createChannel(): Promise<CreateChannelResponse>;
  subscribeToSwapRates(from: string, to: string, callback: any): Promise<any>;
  getLatestSwapRate(from: string, to: string): Promise<string>;
  unsubscribeToSwapRates(from: string, to: string): Promise<void>;
  requestCollateral(tokenAddress: string): Promise<RequestCollateralResponse | void>;
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
  getFreeBalance(assetId?: string): Promise<CFCoreTypes.GetFreeBalanceStateResult>;
  getAppInstances(multisigAddress?: string): Promise<AppInstanceJson[]>;
  getAppInstanceDetails(appInstanceId: string): Promise<CFCoreTypes.GetAppInstanceDetailsResult>;
  getAppState(appInstanceId: string): Promise<CFCoreTypes.GetStateResult>;
  getProposedAppInstances(
    multisigAddress?: string,
  ): Promise<CFCoreTypes.GetProposedAppInstancesResult | undefined>;
  getProposedAppInstance(
    appInstanceId: string,
  ): Promise<CFCoreTypes.GetProposedAppInstanceResult | undefined>;
  proposeInstallApp(
    params: CFCoreTypes.ProposeInstallParams,
  ): Promise<CFCoreTypes.ProposeInstallResult>;
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
