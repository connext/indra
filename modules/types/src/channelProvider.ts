import { Node } from "@counterfactual/node";

/////////////////////////////////////////////
///////// CHANNEL PROVIDER TYPES

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

export type RpcConnection = Node | ChannelProvider;
