import { Node } from "@counterfactual/node";

/////////////////////////////////////////////
///////// CHANNEL PROVIDER TYPES

// TODO: define properly!!
export type ChannelProvider = any;

export type ChannelProviderConfig = {
  freeBalanceAddress: string;
  publicIdentifier: string;
  multisigAddress: string;
};

export enum RpcType {
  ChannelProvider = "ChannelProvider",
  CounterfactualNode = "CounterfactualNode", // rename?
}

// TODO: properly `ChannelProvider` define type
export type RpcConnection = Node | ChannelProvider;
