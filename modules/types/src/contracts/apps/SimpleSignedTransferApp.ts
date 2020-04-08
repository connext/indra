import { Address, Bytes32 } from "../../basic";

import { CoinTransfer } from "../funding";
import { singleAssetTwoPartyCoinTransferEncoding, tidy } from "../misc";

export const SimpleSignedTransferAppName = "SimpleSignedTransferApp";

////////////////////////////////////////
// keep synced w contracts/app/SimpleSignedTransferApp.sol

// ABI Encoding TS Types
export type SimpleSignedTransferAppState = {
  coinTransfers: CoinTransfer[];
  signer: Address;
  paymentId: Bytes32;
  finalized: boolean;
};

// ABI Encodings
export const SimpleSignedTransferAppStateEncoding = tidy(`tuple(
  ${singleAssetTwoPartyCoinTransferEncoding} coinTransfers,
  address signer,
  bytes32 paymentId,
  bool finalized
)`);

export type SimpleSignedTransferAppAction = {
  data: Bytes32;
  signature: string;
};

export const SimpleSignedTransferAppActionEncoding = tidy(`tuple(
  bytes32 data,
  bytes signature
)`);
