import { JsonRpcProvider } from "ethers/providers";
import {
  AppRegistry,
  Contract,
  GetConfigResponse,
  IChannelProvider,
  IClientStore,
  ILoggerService,
  INodeApiClient,
  KeyGen,
  Network,
  Xpub,
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
  xpub: Xpub;
};

export {
  Address,
  AppInstanceInfo,
  AppInstanceJson,
  AppRegistry,
<<<<<<< HEAD
=======
  BigNumber,
  chan_signDigest,
>>>>>>> nats-messaging-refactor
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
<<<<<<< HEAD
  LinkedTransferToRecipientParameters,
  LinkedTransferToRecipientResponse,
=======
  makeChecksum,
  makeChecksumOrEthAddress,
>>>>>>> nats-messaging-refactor
  maxBN,
  minBN,
  NodeInitializationParameters,
  NodeMessageWrappedProtocolMessage,
  RebalanceProfile,
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
  WithdrawParameters,
} from "@connext/types";
