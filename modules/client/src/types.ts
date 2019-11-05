import { IMessagingService } from "@connext/messaging";
import {
  AppRegistry,
  AppState,
  ChannelProvider,
  ChannelState,
  ClientOptions,
  GetConfigResponse,
  MultisigState,
  Store,
} from "@connext/types";
import { Node as CFCoreTypes } from "@counterfactual/types";
import { providers, utils, Wallet } from "ethers";

import { ChannelRouter } from "./channelRouter";
import { NodeApiClient } from "./node";

export type BigNumber = utils.BigNumber;
export const BigNumber = utils.BigNumber;

// TODO: define properly!!
export interface ConnextStore {}

export type InternalClientOptions = ClientOptions & {
  appRegistry: AppRegistry;
  channelRouter: ChannelRouter;
  config: GetConfigResponse;
  contract?: MultisigState;
  ethProvider: providers.JsonRpcProvider;
  messaging: IMessagingService;
  multisigAddress: string;
  network: utils.Network;
  node: NodeApiClient;
  store: Store;
};

////////////////////////////////////////
// NODE TYPES

// General typings
export interface NodeInitializationParameters {
  messaging: IMessagingService;
  logLevel?: number;
  userPublicIdentifier?: string;
  nodePublicIdentifier?: string;
  channelRouter?: ChannelRouter;
}
