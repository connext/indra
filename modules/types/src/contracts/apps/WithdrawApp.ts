import { TransactionResponse } from "ethers/providers";
import { BigNumberish } from "ethers/utils";

import { Address } from "../../basic";

import { CoinTransfer } from "../funding";
import {
  singleAssetTwoPartyCoinTransferEncoding,
  tidy,
} from "../misc";

export const WithdrawAppName = "WithdrawApp";

////////////////////////////////////////
// keep synced w contracts/funding/default-apps/WithdrawApp.sol

// Contract types
export type WithdrawAppState = {
  transfers: CoinTransfer[];
  signatures: string[];
  signers: string[];
  data: string;
  finalized: boolean;
};

export const WithdrawAppStateEncoding = tidy(`tuple(
  ${singleAssetTwoPartyCoinTransferEncoding} transfers,
  bytes[2] signatures,
  address[2] signers,
  bytes32 data,
  bool finalized
)`);

export type WithdrawAppAction = {
  signature: string;
};

export const WithdrawAppActionEncoding = tidy(`tuple(
  bytes signature
)`);

////////////////////////////////////////
// Off-chain app types

// Input/output
export type WithdrawParameters = {
  amount: BigNumberish;
  assetId?: string; // if not provided, will default to 0x0 (Eth)
  recipient?: Address; // if not provided, will default to signer addr
};

export type WithdrawResponse = {
  transaction: TransactionResponse;
};
