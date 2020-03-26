import { BigNumber } from "ethers/utils";

import { CoinTransfer } from "../funding";
import {
  singleAssetTwoPartyCoinTransferEncoding,
  tidy,
} from "../misc";
import { enumify } from "../../utils";

import { SignedTransfer } from "./common";

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
  assetId: string;
  paymentId: string;
  signer: string;
  meta?: object;
};

// Client Controller Response
export type SignedTransferResponse = {
  appId: string;
  paymentId: string;
};

// Client Resolve Params
export type ResolveSignedTransferParameters = {
  conditionType: typeof SignedTransfer;
  paymentId: string;
  data: string;
  signature: string;
};

// Client Resolve Response
export type ResolveSignedTransferResponse = {
  appId: string;
  assetId: string;
  amount: BigNumber;
  sender: string;
  meta?: object;
};

// Getter
export type GetSignedTransferResponse = {
  senderPublicIdentifier: string;
  receiverPublicIdentifier?: string;
  assetId: string;
  amount: string;
  paymentId: string;
  status: SignedTransferStatus;
  meta?: any;
};

// Event Data
export type CreatedSignedTransferMeta = {
  signer: string;
};
