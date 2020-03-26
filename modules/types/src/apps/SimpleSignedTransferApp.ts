import { CoinTransfer } from "../";
import { BigNumber } from "ethers/utils";
import { singleAssetTwoPartyCoinTransferEncoding } from "../contracts";

// TODO: combine?
// App Registry Name
export const SimpleSignedTransferApp = "SimpleSignedTransferApp";

// Transfer Condition Name
export const SIGNED_TRANSFER = "SIGNED_TRANSFER";

// Client Controller Params
export type SignedTransferParameters<T = string> = {
  conditionType: typeof SIGNED_TRANSFER;
  amount: T;
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
  conditionType: typeof SIGNED_TRANSFER;
  paymentId: string;
  data: string;
  signature: string;
};

// Client Resolve Response
export type ResolveSignedTransferResponse<T = string> = {
  appId: string;
  assetId: string;
  amount: T;
  sender: string;
  meta?: object;
};
export type ResolveSignedTransferResponseBigNumber = ResolveSignedTransferResponse<BigNumber>;

// statuses
export const enum SignedTransferStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

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

// ABI Encodings
export const SignedTransferAppStateEncoding = `
  tuple(
    ${singleAssetTwoPartyCoinTransferEncoding} coinTransfers,
    address signer,
    bytes32 paymentId,
    bool finalized
  )
`;
export const SignedTransferAppActionEncoding = `
  tuple(
    bytes32 data,
    bytes signature
  )
`;

// ABI Encoding TS Types
export type SignedTransferAppState<T = string> = {
  coinTransfers: CoinTransfer<T>[];
  signer: string;
  paymentId: string;
  finalized: boolean;
};
export type SignedTransferAppStateBigNumber = SignedTransferAppState<BigNumber>;
export type SignedTransferAppAction = {
  data: string;
  signature: string;
};

// Event Data
export type CreatedSignedTransferMeta = {
  signer: string;
};
