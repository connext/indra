import { BigNumber } from "ethers/utils";

import { CoinTransfer } from "../funding";
import {
  singleAssetTwoPartyCoinTransferEncoding,
  tidy,
} from "../misc";
import { enumify } from "../../utils";

import { SignedTransfer } from "./common";
import { Address, Xpub, Bytes32, HexString, DecString } from "../../basic";

export const SimpleSignedTransferAppName = "SimpleSignedTransferApp";

////////////////////////////////////////
// keep synced w contracts/app/SimpleSignedTransferApp.sol

// ABI Encoding TS Types
export type SimpleSignedTransferAppState = {
  coinTransfers: CoinTransfer[];
  signer: string;
  paymentId: string;
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
  data: string;
  signature: string;
};

export const SimpleSignedTransferAppActionEncoding = tidy(`tuple(
  bytes32 data,
  bytes signature
)`);


////////////////////////////////////////
// Off-chain app types

// statuses
export const SignedTransferStatus = enumify({
  PENDING: "PENDING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
});
export type SignedTransferStatus =
  (typeof SignedTransferStatus)[keyof typeof SignedTransferStatus];

// Client Controller Params
export type SignedTransferParameters = {
  conditionType: typeof SignedTransfer;
  amount: BigNumber;
  assetId: Address;
  paymentId: Bytes32;
  signer: Address;
  recipient?: Xpub;
  meta?: any;
};

// Client Controller Response
export type SignedTransferResponse = {
  appId: Bytes32;
  paymentId: Bytes32;
};

// Client Resolve Params
export type ResolveSignedTransferParameters = {
  conditionType: typeof SignedTransfer;
  paymentId: Bytes32;
  data: Bytes32;
  signature: HexString;
};

// Client Resolve Response
export type ResolveSignedTransferResponse = {
  appId: Bytes32;
  assetId: Address;
  amount: BigNumber;
  sender: Xpub;
  meta?: any;
};

// Getter
export type GetSignedTransferResponse = {
  senderPublicIdentifier: Xpub;
  receiverPublicIdentifier?: Xpub;
  assetId: Address;
  amount: DecString;
  paymentId: Bytes32;
  status: SignedTransferStatus;
  meta?: any;
};

// Event Data
export type CreatedSignedTransferMeta = {
  signer: Address;
};
