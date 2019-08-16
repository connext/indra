import { Address, Node as NodeTypes, OutcomeType } from "@counterfactual/types";
import { BigNumber } from "ethers/utils";

import { NodeChannel } from ".";

////////////////////////////////////
////// APP REGISTRY

export const SupportedApplications = {
  SimpleTwoPartySwapApp: "SimpleTwoPartySwapApp",
  UnidirectionalLinkedTransferApp: "UnidirectionalLinkedTransferApp",
  UnidirectionalTransferApp: "UnidirectionalTransferApp",
};
export type SupportedApplication = keyof typeof SupportedApplications;

export const SupportedNetworks = {
  kovan: "kovan",
  mainnet: "mainnet",
};
export type SupportedNetwork = keyof typeof SupportedNetworks;

export type IRegisteredAppDetails = {
  [index in SupportedApplication]: Partial<
    NodeTypes.ProposeInstallVirtualParams & { initialStateFinalized: boolean }
  >;
};

export type RegisteredAppDetails = {
  id: number;
  name: SupportedApplication;
  network: SupportedNetwork;
  outcomeType: OutcomeType;
  appDefinitionAddress: string;
  stateEncoding: string;
  actionEncoding: string;
};

export type AppRegistry = RegisteredAppDetails[];

export const KnownNodeAppNames = {
  SIMPLE_TWO_PARTY_SWAP: "SimpleTwoPartySwapApp",
  UNIDIRECTIONAL_LINKED_TRANSFER: "UnidirectionalLinkedTransferApp",
  UNIDIRECTIONAL_TRANSFER: "UnidirectionalTransferApp",
};
export type KnownNodeApp = keyof typeof KnownNodeAppNames;

////////////////////////////////////
////// APP TYPES

//////// General
export type App<T = string> = {
  id: number;
  channel: NodeChannel;
  appRegistry: RegisteredAppDetails; // TODO: is this right?
  appId: number;
  xpubPartyA: string;
  xpubPartyB: string;
  depositA: T;
  depositB: T;
  intermediaries: string[];
  initialState: any; // TODO: BAD!!
  timeout: number;
  updates: AppUpdate[];
};
export type AppBigNumber = App<BigNumber>;

export type AppUpdate<T = string> = {
  id: number;
  app: App<T>;
  action: any; // TODO: BAD!!
  sigs: string[];
};
export type AppUpdateBigNumber = AppUpdate<BigNumber>;

export type CoinTransfer<T = string> = {
  amount: T;
  to: Address; // NOTE: must be the xpub!!!
};
export type CoinTransferBigNumber = CoinTransfer<BigNumber>;

// all the types of counterfactual app states
// TODO: add swap app
export type AppState<T = string> =
  | UnidirectionalTransferAppState<T>
  | UnidirectionalLinkedTransferAppState<T>;
export type AppStateBigNumber = AppState<BigNumber>;

// all the types of counterfactual app actions
// TODO: add swap app
export type AppAction<T = string> =
  | UnidirectionalTransferAppAction<T>
  | UnidirectionalLinkedTransferAppAction<T>;
export type AppActionBigNumber = AppAction<BigNumber>;

//////// Swap apps
export type SimpleSwapAppState<T = string> = {
  coinTransfers: CoinTransfer<T>[][];
};
export type SimpleSwapAppStateBigNumber = SimpleSwapAppState<BigNumber>;

////// Unidirectional transfer app
export type UnidirectionalTransferAppState<T = string> = {
  finalized: false;
  transfers: [CoinTransfer<T>, CoinTransfer<T>];
  stage: UnidirectionalTransferAppStage;
  turnNum: T;
};
export type UnidirectionalTransferAppStateBigNumber = UnidirectionalTransferAppState<BigNumber>;

export enum UnidirectionalTransferAppActionType {
  SEND_MONEY,
  END_CHANNEL,
}

export type UnidirectionalTransferAppAction<T = string> = {
  actionType: UnidirectionalTransferAppActionType;
  amount: T;
};

export enum UnidirectionalTransferAppStage {
  POST_FUND,
  MONEY_SENT,
  CHANNEL_CLOSED,
}

////// Unidirectional linked transfer app
export type UnidirectionalLinkedTransferAppState<T = string> = {
  stage: UnidirectionalLinkedTransferAppStage;
  transfers: [CoinTransfer<T>, CoinTransfer<T>];
  linkedHash: string;
  turnNum: T;
  finalized: false;
};
export type UnidirectionalLinkedTransferAppStateBigNumber = UnidirectionalLinkedTransferAppState<
  BigNumber
>;

export type UnidirectionalLinkedTransferAppAction<T = string> = {
  amount: T;
  assetId: Address;
  paymentId: string;
  preImage: string;
};

export type UnidirectionalLinkedTransferAppActionBigNumber = UnidirectionalLinkedTransferAppAction<
  BigNumber
>;

export enum UnidirectionalLinkedTransferAppStage {
  POST_FUND,
  PAYMENT_CLAIMED,
  CHANNEL_CLOSED,
}
