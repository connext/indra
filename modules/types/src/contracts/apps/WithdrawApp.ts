import { Address, Bytes32 } from "../../basic";

import { CoinTransfer } from "../funding";
import { singleAssetTwoPartyCoinTransferEncoding, tidy } from "../misc";

export const WithdrawAppName = "WithdrawApp";

////////////////////////////////////////
// keep synced w contracts/funding/default-apps/WithdrawApp.sol

// Contract types
export type WithdrawAppState = {
  transfers: CoinTransfer[];
  signatures: string[];
  signers: Address[];
  data: Bytes32;
  nonce: Bytes32;
  finalized: boolean;
};

export const WithdrawAppStateEncoding = tidy(`tuple(
  ${singleAssetTwoPartyCoinTransferEncoding} transfers,
  bytes[2] signatures,
  address[2] signers,
  bytes32 data,
  bytes32 nonce,
  bool finalized
)`);

export type WithdrawAppAction = {
  signature: string;
};

export const WithdrawAppActionEncoding = tidy(`tuple(
  bytes signature
)`);
