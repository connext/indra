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

export enum RpcType {
  ChannelProvider = "ChannelProvider",
  CounterfactualNode = "CounterfactualNode", // rename?
}

// TODO: replace any w interface of cfCore (using implementation directly -> circular dependency)
export type RpcConnection = ChannelProvider | any;
