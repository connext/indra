import {
  Address,
  AppRegistry,
  Contract,
  IChannelProvider,
  IChannelSigner,
  IClientStore,
  ILoggerService,
  IMessagingService,
  INodeApiClient,
  Network,
  NodeResponses,
} from "@connext/types";
import { MessagingService } from "@connext/messaging";
import { JsonRpcProvider } from "ethers/providers";

export interface NodeInitializationParameters {
  nodeUrl: string;
  messaging: IMessagingService;
  logger?: ILoggerService;
  userIdentifier?: Address;
  nodeIdentifier?: Address;
  channelProvider?: IChannelProvider;
}

export type InternalClientOptions = {
  appRegistry: AppRegistry;
  channelProvider: IChannelProvider;
  config: NodeResponses.GetConfig;
  ethProvider: JsonRpcProvider;
  logger: ILoggerService;
  messaging: MessagingService;
  network: Network;
  node: INodeApiClient;
  signer: IChannelSigner;
  store: IClientStore;
  token: Contract;
};
