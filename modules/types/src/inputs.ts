import { Address, BigNumber } from "./basic";
import { AssetAmount } from "./channel";
import {
  DepositResult,
  RequestDepositRightsResult,
} from "./methods";

/////////////////////////////////
// Client input types

// Deposit types
// TODO: we should have a way to deposit multiple things
export type DepositParameters<T = string> = Omit<AssetAmount<T>, "assetId"> & {
  assetId?: Address; // if not supplied, assume it is eth
};
export type DepositParametersBigNumber = DepositParameters<BigNumber>;

export type RequestDepositRightsParameters = Omit<DepositParameters, "amount">;

export type RequestDepositRightsResponse = RequestDepositRightsResult;

export type CheckDepositRightsParameters = RequestDepositRightsParameters;

export type CheckDepositRightsResponse<T = string> = {
  assetId: Address;
  multisigBalance: T;
  recipient: Address;
  threshold: T;
};

export type RescindDepositRightsParameters = RequestDepositRightsParameters;

export type RescindDepositRightsResponse = DepositResult;

////// Withdraw types
export type WithdrawParameters<T = string> = DepositParameters<T> & {
  userSubmitted?: boolean;
  recipient?: Address; // if not provided, will default to signer addr
};
export type WithdrawParametersBigNumber = WithdrawParameters<BigNumber>;

////// Generic transfer types
export type TransferParameters<T = string> = DepositParameters<T> & {
  recipient: Address;
  meta?: object;
};
export type TransferParametersBigNumber = TransferParameters<BigNumber>;
