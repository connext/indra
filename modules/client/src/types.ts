import {
  AppRegistry,
  Contract,
  IChannelProvider,
  IChannelSigner,
  IStoreService,
  ILoggerService,
  INodeApiClient,
  Network,
  NodeResponses,
  IMessagingService,
} from "@connext/types";
import { JsonRpcProvider } from "ethers/providers";

export type InternalClientOptions = {
  appRegistry: AppRegistry;
  channelProvider: IChannelProvider;
  config: NodeResponses.GetConfig;
  ethProvider: JsonRpcProvider;
  logger: ILoggerService;
  messaging: IMessagingService;
  network: Network;
  node: INodeApiClient;
  signer: IChannelSigner;
  store: IStoreService;
  token: Contract;
};
