import {
  AppRegistry,
  Contract,
  IChannelProvider,
  IChannelSigner,
  IClientStore,
  ILoggerService,
  Network,
} from "@connext/types";
import { JsonRpcProvider } from "ethers/providers";

export type InternalClientOptions = {
  appRegistry: AppRegistry;
  channelProvider: IChannelProvider;
  ethProvider: JsonRpcProvider;
  logger: ILoggerService;
  network: Network;
  token: Contract;
  signer?: IChannelSigner;
  store?: IClientStore;
};
