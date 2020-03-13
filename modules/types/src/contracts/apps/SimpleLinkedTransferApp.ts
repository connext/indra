import { DecString } from "../../basic";

import { CoinTransfer } from "../funding";
import { singleAssetTwoPartyCoinTransferEncoding } from "../misc";

export const SimpleLinkedTransferApp = "SimpleLinkedTransferApp";

export type SimpleLinkedTransferAppState = {
  coinTransfers: CoinTransfer[];
  linkedHash: string;
  amount: string;
  assetId: string;
  paymentId: string;
  preImage: string;
};

export type SimpleLinkedTransferAppAction = {
  preImage: string;
};

////// Transfer types
export const LINKED_TRANSFER = "LINKED_TRANSFER";
export const LINKED_TRANSFER_TO_RECIPIENT = "LINKED_TRANSFER_TO_RECIPIENT";

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

export const SimpleLinkedTransferAppStateEncoding = `
  tuple(
    ${singleAssetTwoPartyCoinTransferEncoding} coinTransfers,
    bytes32 linkedHash,
    uint256 amount,
    address assetId,
    bytes32 paymentId,
    bytes32 preImage
  )
`;

export const SimpleLinkedTransferAppActionEncoding = `tuple(bytes32 preImage)`;
