import { Address, BigNumber, BigNumberish, HexString } from "../../basic";

import { CoinTransfer } from "../funding";
import { singleAssetTwoPartyCoinTransferEncoding, tidy } from "../misc";

import { LinkedTransfer } from "./common";

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
  amount: BigNumberish;
  assetId?: string;
  paymentId: string;
  preImage: string;
  recipient?: string;
  meta?: object;
};

export type LinkedTransferResponse = {
  appId: string;
  paymentId: string;
  preImage: string;
};

export type ResolveLinkedTransferParameters = {
  conditionType: typeof LinkedTransfer;
  paymentId: string;
  preImage: string;
}

export type ResolveLinkedTransferResponse = {
  appId: string;
  sender: string;
  paymentId: string;
  amount: BigNumber;
  assetId: string;
  meta?: object;
};
