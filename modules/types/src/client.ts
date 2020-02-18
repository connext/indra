import { providers } from "ethers";

import { AppInstanceJson } from "./app";
import { AppActionBigNumber, AppRegistry, AppState, DefaultApp, SupportedApplication } from "./app";
import { BigNumber, Contract, JsonRpcProvider, Network } from "./basic";
import { CFCoreChannel, ChannelAppSequences, ChannelState, RebalanceProfile } from "./channel";
import { ChannelProviderConfig, IChannelProvider, KeyGen } from "./channelProvider";
import { ConnextEvent } from "./events";
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
import { IMessagingService } from "./messaging";
import {
  CreateChannelResponse,
  GetChannelResponse,
  GetConfigResponse,
  INodeApiClient,
  RequestCollateralResponse,
  Transfer,
} from "./node";
import { ProtocolTypes } from "./protocol";
import { IAsyncStorage, IBackupServiceAPI, Store } from "./store";
import { CFCoreTypes } from "./cfCore";

export type InternalClientOptions = ClientOptions & {
  appRegistry: AppRegistry;
  channelProvider: IChannelProvider;
  config: GetConfigResponse;
  ethProvider: JsonRpcProvider;
  messaging: IMessagingService;
  network: Network;
  node: INodeApiClient;
  store: Store;
  token: Contract;
};

// channelProvider, mnemonic, and xpub+keyGen are all optional but one of them needs to be provided
export interface ClientOptions {
  ethProviderUrl: string;
  nodeUrl?: string; // ws:// or nats:// urls are supported
  channelProvider?: IChannelProvider;
  keyGen?: KeyGen;
  mnemonic?: string;
  xpub?: string;
  store?: Store;
  logLevel?: number;
  asyncStorage?: IAsyncStorage;
  messaging?: IMessagingService;
  backupService?: IBackupServiceAPI;
}

export interface IConnextClient {
  ////////////////////////////////////////
  // Properties

  appRegistry: AppRegistry;
  config: GetConfigResponse;
  channelProvider: IChannelProvider;
  ethProvider: providers.JsonRpcProvider;
  freeBalanceAddress: string;
  multisigAddress: string;
  nodePublicIdentifier: string;
  publicIdentifier: string;
  signerAddress: string;

  // Expose some internal machineary for easier debugging
  messaging: IMessagingService;
  store: Store;

  ////////////////////////////////////////
  // Methods

  restart(): Promise<void>;

  ///////////////////////////////////
  // LISTENER METHODS
  on(event: ConnextEvent | CFCoreTypes.RpcMethodName, callback: (...args: any[]) => void): void;
  once(event: ConnextEvent | CFCoreTypes.RpcMethodName, callback: (...args: any[]) => void): void;
  emit(event: ConnextEvent | CFCoreTypes.RpcMethodName, data: any): boolean;
  removeListener(event: ConnextEvent | CFCoreTypes.RpcMethodName, callback: (...args: any[]) => void): void;

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
  requestDepositRights(params: RequestDepositRightsParameters): Promise<ProtocolTypes.RequestDepositRightsResult>;
  rescindDepositRights(params: RescindDepositRightsParameters): Promise<RescindDepositRightsResponse>;
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
          name: SupportedApplication;
          chainId: number;
        }
      | { appDefinitionAddress: string },
  ): Promise<AppRegistry>;
  getRegisteredAppDetails(appName: SupportedApplication): DefaultApp;
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
  deployMultisig(): Promise<ProtocolTypes.DeployStateDepositHolderResult>;
  getStateChannel(): Promise<ProtocolTypes.GetStateChannelResult>;
  providerDeposit(
    amount: BigNumber,
    assetId: string,
    notifyCounterparty: boolean,
  ): Promise<ProtocolTypes.DepositResult>;
  getFreeBalance(assetId?: string): Promise<ProtocolTypes.GetFreeBalanceStateResult>;
  getAppInstances(multisigAddress?: string): Promise<AppInstanceJson[]>;
  getAppInstanceDetails(appInstanceId: string): Promise<ProtocolTypes.GetAppInstanceDetailsResult>;
  getAppState(appInstanceId: string): Promise<ProtocolTypes.GetStateResult>;
  getProposedAppInstances(multisigAddress?: string): Promise<ProtocolTypes.GetProposedAppInstancesResult | undefined>;
  getProposedAppInstance(appInstanceId: string): Promise<ProtocolTypes.GetProposedAppInstanceResult | undefined>;
  proposeInstallApp(params: ProtocolTypes.ProposeInstallParams): Promise<ProtocolTypes.ProposeInstallResult>;
  installVirtualApp(appInstanceId: string): Promise<ProtocolTypes.InstallVirtualResult>;
  installApp(appInstanceId: string): Promise<ProtocolTypes.InstallResult>;
  rejectInstallApp(appInstanceId: string): Promise<ProtocolTypes.UninstallResult>;
  takeAction(appInstanceId: string, action: AppActionBigNumber): Promise<ProtocolTypes.TakeActionResult>;
  updateState(appInstanceId: string, newState: AppState | any): Promise<ProtocolTypes.UpdateStateResult>;
  uninstallApp(appInstanceId: string): Promise<ProtocolTypes.UninstallResult>;
  uninstallVirtualApp(appInstanceId: string): Promise<ProtocolTypes.UninstallVirtualResult>;
}
