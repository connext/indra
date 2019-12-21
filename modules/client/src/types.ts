import { IMessagingService } from "@connext/messaging";
import {
  AppRegistry,
  BigNumber as connextBN,
  ClientOptions,
  GetConfigResponse,
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
  ChannelProviderRpcMethod,
  ChannelProviderRpcMethods,
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
  ConnextRpcMethod,
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
  CFCoreTypes,
  PaymentProfile,
  RequestCollateralResponse,
  ResolveConditionParameters,
  ResolveConditionResponse,
  ResolveLinkedTransferParameters,
  ResolveLinkedTransferToRecipientParameters,
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
  store: Store;
  token: Contract;
};

export interface NodeInitializationParameters {
  messaging: IMessagingService;
  logLevel?: number;
  userPublicIdentifier?: string;
  nodePublicIdentifier?: string;
  channelProvider?: ChannelProvider;
}
