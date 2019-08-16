import { MessagingConfig } from "@connext/messaging";
import { Address, NetworkContext, Node as NodeTypes } from "@counterfactual/types";
import { BigNumber, Network } from "ethers/utils";

import { App, AppState } from "./app";

export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

////////////////////////////////////
////// CHANNEL TYPES

// payment setups
export type PaymentProfile<T = string> = {
  assetId: string;
  minimumMaintainedCollateral: T;
  amountToCollateralize: T;
};
export type PaymentProfileBigNumber = PaymentProfile<BigNumber>;

// asset types
export interface AssetAmount<T = string> {
  amount: T;
  assetId: Address; // empty address if eth
}
export type AssetAmountBigNumber = AssetAmount<BigNumber>;

export type User = {
  id: number;
  xpub: string;
  channels: NodeChannel[];
};

export type NodeChannel = {
  id: number;
  nodePublicIdentifier: string;
  userPublicIdentifier: string;
  multisigAddress: string;
  available: boolean;
};
export type Channel<T = string> = {
  id: number;
  user: User;
  counterpartyXpub: string;
  multisigAddress: string;
  apps: App<T>[];
  updates: ChannelUpdate<T>[];
};
export type ChannelBigNumber = Channel<BigNumber>;

export type ChannelUpdate<T = string> = {
  id: number;
  channel: Channel<T>;
  freeBalancePartyA: T;
  freeBalancePartyB: T;
  nonce: number;
  sigPartyA: string;
  sigPartyB: string;
};
export type ChannelUpdateBigNumber = ChannelUpdate<BigNumber>;

export type ChannelState<T = string> = {
  apps: AppState<T>[];
  // TODO: CF types should all be generic, this will be
  // a BigNumber
  freeBalance: NodeTypes.GetFreeBalanceStateResult;
};
export type ChannelStateBigNumber = ChannelState<BigNumber>;

export type TransferAction = {
  finalize: boolean;
  transferAmount: BigNumber;
};

export type MultisigState<T = string> = {
  id: number;
  xpubA: string;
  xpubB: string;
  multisigAddress: string;
  freeBalanceA: T;
  freeBalanceB: T;
  appIds: number[];
};
export type MultisigStateBigNumber = MultisigState<BigNumber>;

////////////////////////////////////
///////// NODE RESPONSE TYPES

export type ContractAddresses = NetworkContext & {
  Token: string;
  [KnownNodeApp: string]: string;
};

export interface NodeConfig {
  nodePublicIdentifier: string; // x-pub of node
  chainId: string; // network that your channel is on
  nodeUrl: string;
}

// nats stuff
type successResponse = {
  status: "success";
};

type errorResponse = {
  status: "error";
  message: string;
};

export type NatsResponse = {
  data: string;
} & (errorResponse | successResponse);

export type GetConfigResponse = {
  ethNetwork: Network;
  contractAddresses: ContractAddresses;
  nodePublicIdentifier: string;
  messaging: MessagingConfig;
};

export type GetChannelResponse = NodeChannel;

// returns the transaction hash of the multisig deployment
// TODO: this will likely change
export type CreateChannelResponse = {
  transactionHash: string;
};

export type RequestCollateralResponse = NodeTypes.DepositResult | undefined;
