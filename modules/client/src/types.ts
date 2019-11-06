import { IMessagingService } from "@connext/messaging";
import {
  AppRegistry,
  AppState,
  BigNumber as connextBN,
  ChannelProvider,
  ChannelState,
  ClientOptions,
  GetConfigResponse,
  Store,
  SupportedApplication,
  SupportedNetwork,
} from "@connext/types";
import { Node as CFCoreTypes } from "@counterfactual/types";
import { providers, Wallet } from "ethers";
import { Network } from "ethers/utils";

import { ChannelRouter } from "./channelRouter";
import { NodeApiClient } from "./node";

export type BigNumber = connextBN;
export const BigNumber = connextBN;

export type InternalClientOptions = ClientOptions & {
  appRegistry: AppRegistry;
  channelProvider?: ChannelProvider;
  channelRouter: ChannelRouter;
  config: GetConfigResponse;
  ethProvider: providers.JsonRpcProvider;
  messaging: IMessagingService;
  multisigAddress: string;
  network: Network;
  node: NodeApiClient;
  store: Store;
};

export interface NodeInitializationParameters {
  channelRouter?: ChannelRouter;
  logLevel?: number;
  messaging: IMessagingService;
  nodePublicIdentifier?: string;
  userPublicIdentifier?: string;
}

export type AppRegistryDetails = {
  name: SupportedApplication;
  network: SupportedNetwork;
};
