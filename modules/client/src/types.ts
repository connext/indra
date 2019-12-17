import { IMessagingService } from "@connext/messaging";
import {
  AppRegistry,
  BigNumber as connextBN,
  ClientOptions,
  GetConfigResponse,
  NetworkContext,
  Store,
} from "@connext/types";
import { Contract, providers } from "ethers";
import { Network } from "ethers/utils";

import { ChannelProvider } from "./channelProvider";
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
  CFChannelProviderOptions,
  ChannelAppSequences,
  ChannelProvider,
  ChannelProviderConfig,
  ChannelState,
  CheckDepositRightsParameters,
  CheckDepositRightsResponse,
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
  KeyGen,
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
  RequestDepositRightsResponse,
  RescindDepositRightsParameters,
  RescindDepositRightsResponse,
  RpcConnection,
  SimpleLinkedTransferAppState,
  SimpleLinkedTransferAppStateBigNumber,
  SimpleSwapAppState,
  SimpleSwapAppStateBigNumber,
  SimpleTransferAppState,
  SimpleTransferAppStateBigNumber,
  StateChannelJSON,
  Store,
  StorePair,
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
  channelProvider: ChannelProvider;
  config: GetConfigResponse;
  ethProvider: providers.JsonRpcProvider;
  messaging: IMessagingService;
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
  channelProvider?: ChannelProvider;
}

export enum NewRpcMethodName {
  STORE_SET = "chan_storeSet",
  STORE_GET = "chan_storeGet",
  NODE_AUTH = "chan_nodeAuth",
  CONFIG = "chan_config",
  RESTORE_STATE = "chan_restoreState",
  GET_STATE_CHANNEL = "chan_getStateChannel",
}
