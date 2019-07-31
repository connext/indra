import { IMessagingService } from "@connext/messaging";
import {
  AppRegistry,
  AppState,
  ChannelProvider,
  ChannelState,
  MultisigState,
} from "@connext/types";
import { Node } from "@counterfactual/node";
import { providers, utils, Wallet } from "ethers";

import { ConnextListener } from "./listener";
import { NodeApiClient } from "./node";

export type BigNumber = utils.BigNumber;
export const BigNumber = utils.BigNumber;

export interface ClientOptions {
  // provider, passed through to CF node
  ethProviderUrl: string;

  // node information
  nodeUrl: string; // ws:// or nats:// urls are supported

  // signing options, include at least one of the following
  mnemonic: string;

  // channel provider
  channelProvider?: ChannelProvider;

  // function passed in by wallets to generate ephemeral keys
  // used when signing applications
  keyGen?: () => Promise<string>; // TODO: what will the type look like?
  safeSignHook?: (state: ChannelState | AppState) => Promise<string>;
  // TODO: Do we need these if we use the whole store?
  loadState?: (key: string) => Promise<string | null>;
  saveState?: (
    pairs: {
      key: string;
      value: any;
    }[],
  ) => Promise<void>;
  store: any;
  // TODO: state: string?
  logLevel?: number; // see logger.ts for meaning, optional

  // TODO: should be used in internal options? --> only if hardcoded
  // nats communication config, client must provide
  natsClusterId?: string;
  natsToken?: string;
}

export type InternalClientOptions = ClientOptions & {
  appRegistry: AppRegistry;
  cfModule: Node; // counterfactual node
  contract?: MultisigState;
  messaging: IMessagingService;
  multisigAddress: string;
  network: utils.Network; // TODO: delete! use bos branch!
  node: NodeApiClient;
  nodePublicIdentifier: string;
  ethProvider: providers.JsonRpcProvider;
  wallet: Wallet; // signing wallet/information
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
