import { JsonRpcProvider } from "ethers/providers";
import {
  AppRegistry,
  Contract,
  GetConfigResponse,
  IChannelProvider,
  IClientStore,
  ILoggerService,
  IMessagingService,
  INodeApiClient,
  KeyGen,
  Network,
  Xpub,
} from "@connext/types";

// This type is only ever used inside the client,
// No need to keep it in the global types package.
export type InternalClientOptions = {
  appRegistry: AppRegistry;
  channelProvider: IChannelProvider;
  config: GetConfigResponse;
  ethProvider: JsonRpcProvider;
  keyGen: KeyGen;
  logger: ILoggerService;
  messaging: IMessagingService;
  network: Network;
  node: INodeApiClient;
  store: IClientStore;
  token: Contract;
  xpub: Xpub;
};

export {
  Address,
  AppInstanceInfo,
  AppInstanceJson,
  AppRegistry,
  calculateExchange,
  CFChannelProviderOptions,
  ChannelAppSequences,
  ChannelProviderConfig,
  ChannelState,
  CheckDepositRightsParameters,
  CheckDepositRightsResponse,
  ClientOptions,
  ConnextClientStorePrefix,
  ConnextEventEmitter,
  CreateChannelMessage,
  CreateChannelResponse,
  DefaultApp,
  DepositConfirmationMessage,
  DepositFailedMessage,
  DepositParameters,
  DepositStartedMessage,
  fromWad,
  GetChannelResponse,
  GetConfigResponse,
  IChannelProvider,
  IConnextClient,
  INodeApiClient,
  InstallMessage,
  inverse,
  IRpcConnection,
  isBN,
  IStoreService,
  JsonRpcRequest,
  KeyGen,
  LinkedTransferParameters,
  LinkedTransferResponse,
  LinkedTransferToRecipientParameters,
  LinkedTransferToRecipientResponse,
  maxBN,
  minBN,
  NodeInitializationParameters,
  NodeMessageWrappedProtocolMessage,
  RebalanceProfile,
  PendingAsyncTransfer,
  ProposeMessage,
  RejectProposalMessage,
  RequestCollateralResponse,
  RequestDepositRightsParameters,
  RequestDepositRightsResponse,
  RescindDepositRightsParameters,
  RescindDepositRightsResponse,
  ResolveConditionParameters,
  ResolveConditionResponse,
  ResolveLinkedTransferParameters,
  ResolveLinkedTransferResponse,
  ResolveLinkedTransferToRecipientParameters,
  StateChannelJSON,
  Store,
  StorePair,
  SwapParameters,
  toBN,
  tokenToWei,
  toWad,
  TransferInfo,
  TransferParameters,
  UninstallMessage,
  UpdateStateMessage,
  weiToToken,
  WithdrawalResponse,
  WithdrawConfirmationMessage,
  WithdrawFailedMessage,
  WithdrawParameters,
  WithdrawStartedMessage,
} from "@connext/types";
