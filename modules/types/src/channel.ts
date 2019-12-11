import { TransactionResponse } from "ethers/providers";
import { BigNumber } from "ethers/utils";

import { Address, AppInstanceJson, CFCoreTypes } from "./cf";

////////////////////////////////////
////// CHANNEL TYPES

// used to verify channel is in sequence
export type ChannelAppSequences = {
  userSequenceNumber: number;
  nodeSequenceNumber: number;
};

// payment setups
export type PaymentProfile<T = string> = {
  assetId: string;
  minimumMaintainedCollateral: T;
  amountToCollateralize: T;
};
export type PaymentProfileBigNumber = PaymentProfile<BigNumber>;

// asset types
export type AssetAmount<T = string> = {
  amount: T;
  assetId: Address; // empty address if eth
}
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
  freeBalance: CFCoreTypes.GetFreeBalanceStateResult;
};
export type ChannelStateBigNumber = ChannelState<BigNumber>;

export type TransferAction = {
  finalize: boolean;
  transferAmount: BigNumber;
};

export type WithdrawalResponse = ChannelState & { transaction: TransactionResponse };
