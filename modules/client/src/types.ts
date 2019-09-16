import { IMessagingService } from "@connext/messaging";
import {
  AppRegistry,
  AppState,
  ChannelProvider,
  ChannelState,
  MultisigState,
} from "@connext/types";
import { Node as CFCoreTypes } from "@counterfactual/types";
import { providers, utils } from "ethers";

import { CFCore } from "./lib/cfCore";
import { NodeApiClient } from "./node";

export type BigNumber = utils.BigNumber;
export const BigNumber = utils.BigNumber;

export interface ClientOptions {
  // provider, passed through to CF node
  ethProviderUrl: string;

  // node information
  nodeUrl: string; // ws:// or nats:// urls are supported

  // redis URL for lock service, if directly using
  // if useRedisLock is set, must provide redis URL
  useRedisLock?: boolean;
  redisUrl?: string;

  // signing options, include at least one of the following
  mnemonic: string;

  // channel provider
  channelProvider?: ChannelProvider;

  // function passed in by wallets to generate ephemeral keys
  // used when signing applications
  keyGen?: () => Promise<string>; // TODO: what will the type look like?
  safeSignHook?: (state: ChannelState | AppState) => Promise<string>;
  store: CFCoreTypes.IStoreService;
  // TODO: state: string?
  logLevel?: number; // see logger.ts for meaning, optional

  // TODO: should be used in internal options? --> only if hardcoded
  // nats communication config, client must provide
  natsClusterId?: string;
  natsToken?: string;
}

export type InternalClientOptions = ClientOptions & {
  appRegistry: AppRegistry;
  cfCore: CFCore;
  contract?: MultisigState;
  messaging: IMessagingService;
  multisigAddress: string;
  network: utils.Network; // TODO: delete! use bos branch!
  node: NodeApiClient;
  nodePublicIdentifier: string;
  ethProvider: providers.JsonRpcProvider;
};

// TODO: define properly!!
export interface ConnextStore {}

///////////////////////////////////
////////// NODE TYPES ////////////
/////////////////////////////////

////// General typings
export interface NodeInitializationParameters {
  messaging: IMessagingService;
  logLevel?: number;
  userPublicIdentifier?: string;
  nodePublicIdentifier?: string;
}
