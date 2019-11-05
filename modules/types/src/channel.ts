import { Node as CFCoreTypes } from "@counterfactual/types";
import { BigNumber } from "ethers/utils";

import { App, AppState } from "./app";
import { Address } from "./basic";

////////////////////////////////////
////// CHANNEL TYPES

// used to verify channel is in sequence
export type ChannelAppSequences = {
  userAppSequenceNumber: number;
  nodeAppSequenceNumber: number;
};

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
  channels: CFCoreChannel[];
};

export type CFCoreChannel = {
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
  freeBalance: CFCoreTypes.GetFreeBalanceStateResult;
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
