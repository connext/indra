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
  channelRouter: ChannelRouter;
  channelProvider?: ChannelProvider;
  config: GetConfigResponse;
  ethProvider: providers.JsonRpcProvider;
  messaging: IMessagingService;
  multisigAddress: string;
  network: Network;
  node: NodeApiClient;
  store: Store;
};

export interface NodeInitializationParameters {
  messaging: IMessagingService;
  logLevel?: number;
  userPublicIdentifier?: string;
  nodePublicIdentifier?: string;
  channelRouter?: ChannelRouter;
}
