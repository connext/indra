import { CoinTransfer } from "../";
import { BigNumber } from "ethers/utils";
import { singleAssetTwoPartyCoinTransferEncoding } from "../contracts";
import { Address } from "../basic";
import { TransactionResponse } from "ethers/providers";

export const WithdrawApp = "WithdrawApp";

// Contract types
export type WithdrawAppState<T = string> = {
  transfers: CoinTransfer<T>[];
  signatures: string[];
  signers: string[];
  data: string;
  finalized: boolean;
}
export type WithdrawAppStateBigNumber = WithdrawAppState<BigNumber>;
export type WithdrawAppAction = {
  signature: string;
}

// Input/output
export type WithdrawParameters<T = string> = {
  amount: T;
  assetId?: string; // if not provided, will default to 0x0 (Eth)
  recipient?: Address; // if not provided, will default to signer addr
};
export type WithdrawParametersBigNumber = WithdrawParameters<BigNumber>;

export type WithdrawResponse = {
  transaction: TransactionResponse;
}

export const WithdrawAppStateEncoding = `tuple(
  ${singleAssetTwoPartyCoinTransferEncoding} transfers,
  bytes[2] signatures,
  address[2] signers,
  bytes32 data,
  bool finalized
)`;

export const WithdrawAppActionEncoding = `tuple(bytes signature)`;