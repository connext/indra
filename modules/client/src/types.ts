import { JsonRpcProvider } from "ethers/providers";
import {
  AppRegistry,
  Contract,
  GetConfigResponse,
  IChannelProvider,
  ILoggerService,
  INodeApiClient,
  KeyGen,
  Network,
  IClientStore,
} from "@connext/types";
import { MessagingService } from "@connext/messaging";

// This type is only ever used inside the client,
// No need to keep it in the global types package.
export type InternalClientOptions = {
  appRegistry: AppRegistry;
  channelProvider: IChannelProvider;
  config: GetConfigResponse;
  ethProvider: JsonRpcProvider;
  keyGen: KeyGen;
  logger: ILoggerService;
  messaging: MessagingService;
  network: Network;
  node: INodeApiClient;
  store: IClientStore;
  token: Contract;
  xpub: string;
};

export {
  Address,
  AppInstanceInfo,
  AppInstanceJson,
  AppRegistry,
  BigNumber,
  calculateExchange,
  CFChannelProviderOptions,
  CFCoreChannel,
  CFCoreTypes,
  chan_setUserWithdrawal,
  ChannelAppSequences,
  ChannelProviderConfig,
  ChannelProviderRpcMethod,
  ChannelState,
  CheckDepositRightsParameters,
  CheckDepositRightsResponse,
  ClientOptions,
  CoinTransferBigNumber,
  ConnextClientStorePrefix,
  ConnextEvent,
  ConnextEventEmitter,
  ConnextEvents,
  ConnextRpcMethod,
  ConnextRpcMethods,
  convert,
  CreateChannelMessage,
  CreateChannelResponse,
  DefaultApp,
  DepositConfirmationMessage,
  DepositFailedMessage,
  DepositParameters,
  DepositStartedMessage,
  fromWei,
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
  makeChecksum,
  makeChecksumOrEthAddress,
  maxBN,
  minBN,
  NodeInitializationParameters,
  NodeMessageWrappedProtocolMessage,
  RebalanceProfile,
  PendingAsyncTransfer,
  ProposeMessage,
  ProtocolTypes,
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
  StateChannelJSON,
  Store,
  StorePair,
  SwapParameters,
  toBN,
  tokenToWei,
  toWei,
  Transfer,
  TransferParameters,
  UninstallMessage,
  UpdateStateMessage,
  weiToToken,
  WithdrawParameters,
} from "@connext/types";
