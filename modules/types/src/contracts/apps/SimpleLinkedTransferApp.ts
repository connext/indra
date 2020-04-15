import { Address, BigNumber, HexString } from "../../basic";
import { tidy } from "../../utils";

import { CoinTransfer } from "../funding";
import { singleAssetTwoPartyCoinTransferEncoding } from "../misc";

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
