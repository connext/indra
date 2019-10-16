import { IMessagingService } from "@connext/messaging";
import {
  AppRegistry,
  AppState,
  ChannelProvider,
  ChannelState,
  ContractAddresses,
  GetConfigResponse,
  MultisigState,
} from "@connext/types";
import { Node as CFCoreTypes } from "@counterfactual/types";
import { providers, utils, Wallet } from "ethers";

import { ChannelRouter } from "./channelRouter";
import { CFCore } from "./lib/cfCore";
import { NodeApiClient } from "./node";

export type BigNumber = utils.BigNumber;
export const BigNumber = utils.BigNumber;

interface Store extends CFCoreTypes.IStoreService {
  set(
    pairs: {
      path: string;
      value: any;
    }[],
    shouldBackup?: Boolean,
  ): Promise<void>;
  restore(): Promise<{ path: string; value: any }[]>;
}

export interface ClientOptions {
  // provider, passed through to CF node
  ethProviderUrl: string;
  // node information
  nodeUrl: string; // ws:// or nats:// urls are supported

  // signing options, include either a mnemonic directly
  mnemonic?: string;

  // or a channel provider
  channelProvider?: ChannelProvider;
  // function passed in by wallets to generate ephemeral keys
  // used when signing applications
  keyGen?: () => Promise<string>; // TODO: what will the type look like?
  safeSignHook?: (state: ChannelState | AppState) => Promise<string>;
  store: Store;
  // TODO: state: string?
  logLevel?: number; // see logger.ts for meaning, optional
  // TODO: should be used in internal options? --> only if hardcoded
  // nats communication config, client must provide
  natsClusterId?: string;
  natsToken?: string;
}

export type InternalClientOptions = ClientOptions & {
  appRegistry: AppRegistry;
  channelRouter: ChannelRouter;
  config: GetConfigResponse;
  contract?: MultisigState;
  ethProvider: providers.JsonRpcProvider;
  messaging: IMessagingService;
  multisigAddress: string;
  network: utils.Network; // TODO: delete! use bos branch!
  node: NodeApiClient;
  store: Store;
};

// TODO: define properly!!
export interface ConnextStore {}

////////////////////////////////////////
// NODE TYPES

// General typings
export interface NodeInitializationParameters {
  messaging: IMessagingService;
  logLevel?: number;
  userPublicIdentifier?: string;
  nodePublicIdentifier?: string;
  wallet?: Wallet;
}
