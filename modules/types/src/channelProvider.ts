import EventEmitter from "events";

import { NetworkContext } from "./contracts";
import { ProtocolTypes } from "./protocol";
import { Store, StorePair } from "./store";
import { CFCoreTypes } from "./cfCore";

export interface IChannelProvider extends EventEmitter {
  ////////////////////////////////////////
  // Properties

  connected: boolean;
  connection: IRpcConnection;
  _config: ChannelProviderConfig | undefined;
  _multisigAddress: string | undefined;
  _signerAddress: string | undefined;

  ////////////////////////////////////////
  // Methods

  enable(): Promise<ChannelProviderConfig>;
  send(method: ChannelProviderRpcMethod, params: any): Promise<any>;
  close(): void;

  ///////////////////////////////////
  // GETTERS / SETTERS
  isSigner: boolean;
  config: ChannelProviderConfig | undefined;
  multisigAddress: string | undefined;
  signerAddress: string | undefined;

  ///////////////////////////////////
  // LISTENER METHODS
  on(event: string, listener: (...args: any[]) => void): any;
  once(event: string, listener: (...args: any[]) => void): any;

  ///////////////////////////////////
  // SIGNING METHODS
  signMessage(message: string): Promise<string>;

  ///////////////////////////////////
  // STORE METHODS
  get(path: string): Promise<any>;
  set(pairs: StorePair[], allowDelete?: Boolean): Promise<void>;
  restoreState(path: string): Promise<void>;

  ///////////////////////////////////
  // PRIVATE METHODS
  _send(method: ChannelProviderRpcMethod, params: any): Promise<any>;
}

export const chan_config = `chan_config`;
export const chan_nodeAuth = `chan_nodeAuth`;
export const chan_restoreState = `chan_restoreState`;
export const chan_storeGet = `chan_storeGet`;
export const chan_storeSet = `chan_storeSet`;

// TODO: merge ConnextRpcMethods and RpcMethodNames???

export const ConnextRpcMethods = {
  [chan_config]: chan_config,
  [chan_nodeAuth]: chan_nodeAuth,
  [chan_restoreState]: chan_restoreState,
  [chan_storeGet]: chan_storeGet,
  [chan_storeSet]: chan_storeSet,
};
export type ConnextRpcMethod = keyof typeof ConnextRpcMethods;

export type ChannelProviderRpcMethod = ConnextRpcMethod | CFCoreTypes.RpcMethodName;

export type ChannelProviderConfig = {
  freeBalanceAddress: string;
  multisigAddress?: string; // may not be deployed yet
  natsClusterId?: string;
  natsToken?: string;
  nodeUrl: string;
  signerAddress: string;
  userPublicIdentifier: string;
};

export interface CFChannelProviderOptions {
  ethProvider: any;
  keyGen: ProtocolTypes.IPrivateKeyGenerator;
  lockService?: ProtocolTypes.ILockService;
  messaging: any;
  networkContext: NetworkContext;
  nodeConfig: any;
  nodeUrl: string;
  xpub: string;
  store: Store;
}

export type JsonRpcRequest = {
  id: number;
  jsonrpc: `2.0`;
  method: string;
  params: any;
};

export type KeyGen = (index: string) => Promise<string>;

export interface IRpcConnection extends EventEmitter {
  ////////////////////////////////////////
  // Properties
  connected: boolean;

  ////////////////////////////////////////
  // Methods
  send(payload: JsonRpcRequest): Promise<any>;
  open(): void;
  close(): void;
}
