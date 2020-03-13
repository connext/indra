import { DecString, IntString } from "../../basic";

import { CoinTransfer } from "../funding";
import { singleAssetTwoPartyCoinTransferEncoding } from "../misc";

export const FAST_SIGNED_TRANSFER = "FAST_SIGNED_TRANSFER";

export const FastSignedTransferApp = "FastSignedTransferApp";

export type FastSignedTransferParameters = {
  conditionType: typeof FAST_SIGNED_TRANSFER;
  recipient: string;
  amount: DecString;
  assetId?: string;
  paymentId: string;
  maxAllocation?: IntString;
  signer: string;
  meta?: object;
};

export type FastSignedTransferResponse = {
  transferAppInstanceId: string;
};

export type ResolveFastSignedTransferParameters = {
  conditionType: typeof FAST_SIGNED_TRANSFER;
  paymentId: string;
  data: string;
  signature: string;
};

export type ResolveFastSignedTransferResponse = {
  appId: string;
  sender: string;
  paymentId: string;
  amount: DecString;
  assetId: string;
  signer: string;
  meta?: object;
};

export enum FastSignedTransferActionType {
  CREATE,
  UNLOCK,
  REJECT,
}

export type FastSignedTransferAppState = {
  recipientXpub: string;
  amount: DecString;
  signer: string;
  paymentId: string;
  coinTransfers: [CoinTransfer, CoinTransfer];
  turnNum: IntString;
};

export type FastSignedTransferAppAction = {
  recipientXpub: string;
  amount: DecString;
  signer: string;
  paymentId: string;
  data: string;
  signature: string;
  actionType: FastSignedTransferActionType;
};

export const FastSignedTransferAppStateEncoding = `
  tuple(
    string recipientXpub,
    uint256 amount,
    address signer,
    bytes32 paymentId,
    ${singleAssetTwoPartyCoinTransferEncoding} coinTransfers,
    uint256 turnNum
  )
`;

export const FastSignedTransferAppActionEncoding = `
  tuple(
    string recipientXpub,
    uint256 amount,
    address signer,
    bytes32 paymentId,
    bytes32 data,
    bytes signature,
    uint256 actionType
  )
`;
