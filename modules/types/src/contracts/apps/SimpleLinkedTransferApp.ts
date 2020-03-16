import { Address, BigNumber, HexString } from "../../basic";

import { CoinTransfer } from "../funding";
import { singleAssetTwoPartyCoinTransferEncoding, tidy } from "../misc";

import { LinkedTransfer, LinkedTransferToRecipient } from "./common";

export const SimpleLinkedTransferAppName = "SimpleLinkedTransferApp";

////////////////////////////////////////
// keep synced w contracts/app/SimpleLinkedTransferApp.sol

export type SimpleLinkedTransferAppState = {
  coinTransfers: CoinTransfer[];
  linkedHash: HexString;
  amount: BigNumber;
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
  conditionType: typeof LinkedTransfer;
  amount: BigNumber;
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
  conditionType: typeof LinkedTransferToRecipient;
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
  amount: BigNumber;
  assetId: string;
  conditionType: typeof LinkedTransferToRecipient;
};

export type ResolveLinkedTransferResponse = {
  appId: string;
  sender: string;
  paymentId: string;
  amount: BigNumber;
  assetId: string;
  meta?: object;
};
