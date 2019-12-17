import { CFCoreTypes } from "./cf";

export type ChannelProvider = any;

export type ChannelProviderConfig = {
  freeBalanceAddress: string;
  multisigAddress?: string; // may not be deployed yet
  natsClusterId?: string;
  natsToken?: string;
  nodeUrl: string;
  signerAddress: string;
  type: RpcType;
  userPublicIdentifier: string;
};

export const RpcTypes = {
  ChannelProvider: "ChannelProvider",
  CounterfactualNode: "CounterfactualNode",
};
export type RpcType = keyof typeof RpcTypes;

// TODO: replace any w interface of cfCore (using implementation directly -> circular dependency)
export type RpcConnection = ChannelProvider | any;

export const ChannelProviderRpcMethods = {
  ...CFCoreTypes.RpcMethodNames,
  chan_config: "chan_config",
  chan_nodeAuth: "chan_nodeAuth",
  chan_storeGet: "chan_storeGet",
  chan_storeSet: "chan_storeSet",
};
export type ChannelProviderRpcMethod = keyof typeof ChannelProviderRpcMethods;
