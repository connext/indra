import { Address, DecString, HexString } from "../../basic";

import { CoinTransfer } from "../funding";
import { singleAssetTwoPartyCoinTransferEncoding, tidy } from "../misc";

export const SimpleLinkedTransferApp = "SimpleLinkedTransferApp";
export const LINKED_TRANSFER = "LINKED_TRANSFER";
export const LINKED_TRANSFER_TO_RECIPIENT = "LINKED_TRANSFER_TO_RECIPIENT";

////////////////////////////////////////
// keep synced w contracts/app/SimpleLinkedTransferApp.sol

export type SimpleLinkedTransferAppState = {
  coinTransfers: CoinTransfer[];
  linkedHash: HexString;
  amount: DecString;
  assetId: Address;
  paymentId: HexString;
  preImage: HexString;
};

export const SimpleLinkedTransferAppStateEncoding = tidy(`tuple(
  ${singleAssetTwoPartyCoinTransferEncoding} coinTransfers,
  bytes32 linkedHash,
  uint256 amount,
  address assetId,
  bytes32 paymentId,
  bytes32 preImage
)`);

export type SimpleLinkedTransferAppAction = {
  preImage: HexString;
};

export const SimpleLinkedTransferAppActionEncoding = tidy(`tuple(
  bytes32 preImage
)`);

////////////////////////////////////////
// Off-chain app types

// linked transfer types
export type LinkedTransferParameters = {
  conditionType: typeof LINKED_TRANSFER;
  amount: string;
  assetId?: string;
  paymentId: string;
  preImage: string;
  meta?: object;
};

export type LinkedTransferResponse = {
  paymentId: string;
  preImage: string;
  meta?: object;
};

export type LinkedTransferToRecipientParameters = Omit<
  LinkedTransferParameters,
  "conditionType"
> & {
  conditionType: typeof LINKED_TRANSFER_TO_RECIPIENT;
  recipient: string;
};

export type LinkedTransferToRecipientResponse = LinkedTransferResponse & {
  recipient: string;
};

export type ResolveLinkedTransferParameters = Omit<
  LinkedTransferParameters,
  "amount" | "assetId" | "meta"
>;

export type ResolveLinkedTransferToRecipientParameters = Omit<
  ResolveLinkedTransferParameters,
  "recipient" | "conditionType"
> & {
  amount: DecString;
  assetId: string;
  conditionType: typeof LINKED_TRANSFER_TO_RECIPIENT;
};

export type ResolveLinkedTransferResponse = {
  appId: string;
  sender: string;
  paymentId: string;
  amount: DecString;
  assetId: string;
  meta?: object;
};
