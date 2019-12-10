import { IMessagingService } from "@connext/messaging";
import {
  AppRegistry,
  BigNumber as connextBN,
  ChannelProvider,
  ClientOptions,
  GetConfigResponse,
  NetworkContext,
  Store,
} from "@connext/types";
import { Contract, providers, Wallet } from "ethers";
import { Network } from "ethers/utils";

import { ChannelRouter } from "./channelRouter";
import { NodeApiClient } from "./node";

export {
  CreateChannelMessage,
  DepositConfirmationMessage,
  DepositFailedMessage,
  DepositStartedMessage,
  EXTENDED_PRIVATE_KEY_PATH,
  InstallMessage,
  InstallVirtualMessage,
  NodeMessageWrappedProtocolMessage,
  ProposeMessage,
  RejectInstallVirtualMessage,
  RejectProposalMessage,
  UninstallMessage,
  UninstallVirtualMessage,
  UpdateStateMessage,
  WithdrawConfirmationMessage,
  WithdrawFailedMessage,
  WithdrawStartedMessage,
} from "@connext/cf-core";

export {
  Address,
  App,
  AppActionBigNumber,
  AppInstanceInfo,
  AppInstanceJson,
  AppRegistry,
  AppStateBigNumber,
  CFCoreChannel,
  ChannelAppSequences,
  ChannelState,
  ClientOptions,
  CoinBalanceRefundAppState,
  CoinBalanceRefundAppStateBigNumber,
  CoinTransferBigNumber,
  ConditionalTransferParameters,
  ConditionalTransferResponse,
  ConnextClientStorePrefix,
  ConnextEvent,
  ConnextEvents,
  convert,
  CreateChannelResponse,
  DefaultApp,
  DepositParameters,
  GetChannelResponse,
  GetConfigResponse,
  IConnextClient,
  LinkedTransferParameters,
  LinkedTransferResponse,
  LinkedTransferToRecipientParameters,
  LinkedTransferToRecipientResponse,
  makeChecksum,
  makeChecksumOrEthAddress,
  Node as CFCoreTypes,
  PaymentProfile,
  RequestCollateralResponse,
  ResolveConditionParameters,
  ResolveConditionResponse,
  ResolveLinkedTransferParameters,
  ResolveLinkedTransferResponse,
  RequestDepositRightsParameters,
  RpcConnection,
  RpcType,
  SimpleLinkedTransferAppState,
  SimpleLinkedTransferAppStateBigNumber,
  SimpleSwapAppState,
  SimpleSwapAppStateBigNumber,
  SimpleTransferAppState,
  SimpleTransferAppStateBigNumber,
  StateChannelJSON,
  Store,
  SupportedApplication,
  SupportedApplications,
  SupportedNetwork,
  SwapParameters,
  Transfer,
  TransferCondition,
  TransferParameters,
  WithdrawalResponse,
  WithdrawParameters,
} from "@connext/types";

export type BigNumber = connextBN;
export const BigNumber = connextBN;

export type InternalClientOptions = ClientOptions & {
  appRegistry: AppRegistry;
  channelRouter: ChannelRouter;
  channelProvider?: ChannelProvider;
  config: GetConfigResponse;
  ethProvider: providers.JsonRpcProvider;
  messaging: IMessagingService;
  multisigAddress: string;
  network: Network;
  node: NodeApiClient;
  token: Contract;
  store: Store;
};

export interface NodeInitializationParameters {
  messaging: IMessagingService;
  logLevel?: number;
  userPublicIdentifier?: string;
  nodePublicIdentifier?: string;
  channelRouter?: ChannelRouter;
}

export enum NewRpcMethodName {
  STORE_SET = "chan_storeSet",
  STORE_GET = "chan_storeGet",
  NODE_AUTH = "chan_nodeAuth",
  CONFIG = "chan_config",
  RESTORE_STATE = "chan_restoreState",
  GET_STATE_CHANNEL = "chan_getStateChannel",
}

export type ChannelRouterConfig = {
  freeBalanceAddress: string;
  multisigAddress?: string; // may not be deployed yet
  natsClusterId?: string;
  natsToken?: string;
  nodeUrl: string;
  signerAddress: string;
  userPublicIdentifier: string;
};

export interface CFChannelProviderOptions {
  messaging: any;
  store: Store;
  networkContext: NetworkContext;
  nodeConfig: any;
  ethProvider: any;
  lockService?: CFCoreTypes.ILockService;
  xpub: string;
  keyGen: CFCoreTypes.IPrivateKeyGenerator;
  nodeUrl: string;
}
