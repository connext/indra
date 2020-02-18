import { AppInstanceJson } from "./app";
import { Address, BigNumber, TransactionResponse } from "./basic";
import { ProtocolTypes } from "./protocol";

////////////////////////////////////
////// CHANNEL TYPES

// used to verify channel is in sequence
export type ChannelAppSequences = {
  userSequenceNumber: number;
  nodeSequenceNumber: number;
};

// payment setups
export type RebalanceProfile<T = string> = {
  assetId: string;
  upperBoundCollateralize: T;
  lowerBoundCollateralize: T;
  upperBoundReclaim: T;
  lowerBoundReclaim: T;
};
export type RebalanceProfileBigNumber = RebalanceProfile<BigNumber>;

// asset types
export type AssetAmount<T = string> = {
  amount: T;
  assetId: Address; // empty address if eth
};
export type AssetAmountBigNumber = AssetAmount<BigNumber>;

export type CFCoreChannel = {
  id: number;
  nodePublicIdentifier: string;
  userPublicIdentifier: string;
  multisigAddress: string;
  available: boolean;
  collateralizationInFlight: boolean;
};

export type ChannelState<T = string> = {
  apps: AppInstanceJson[]; // result of getApps()
  // TODO: CF types should all be generic, this will be
  // a BigNumber
  freeBalance: ProtocolTypes.GetFreeBalanceStateResult;
};
export type ChannelStateBigNumber = ChannelState<BigNumber>;

export type TransferAction = {
  finalize: boolean;
  transferAmount: BigNumber;
};

export type WithdrawalResponse = ChannelState & { transaction: TransactionResponse };
