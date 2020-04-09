import {
  AppRegistry,
  IMessagingService,
  Contract,
  NodeResponses,
  IChannelProvider,
  IClientStore,
  ILoggerService,
  INodeApiClient,
  Network,
  Address,
} from "@connext/types";
import { MessagingService } from "@connext/messaging";
import { Signer } from "ethers";
import { JsonRpcProvider } from "ethers/providers";

export interface NodeInitializationParameters {
  nodeUrl: string;
  messaging: IMessagingService;
  logger?: ILoggerService;
  userPublicIdentifier?: Address;
  nodePublicIdentifier?: Address;
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
  signer: Signer;
  store: IClientStore;
  token: Contract;
};
