import { JsonRpcProvider } from "ethers/providers";
import {
  AppRegistry,
  IMessagingService,
  Contract,
  NodeResponses,
  IChannelProvider,
  IClientStore,
  ILoggerService,
  INodeApiClient,
  KeyGen,
  Network,
  Xpub,
} from "@connext/types";
import { MessagingService } from "@connext/messaging";

export interface NodeInitializationParameters {
  nodeUrl: string;
  messaging: IMessagingService;
  logger?: ILoggerService;
  userPublicIdentifier?: string;
  nodePublicIdentifier?: string;
  channelProvider?: IChannelProvider;
}

export type InternalClientOptions = {
  appRegistry: AppRegistry;
  channelProvider: IChannelProvider;
  config: NodeResponses.GetConfig;
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
