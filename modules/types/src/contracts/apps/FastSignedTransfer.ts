import { Address, DecString, HexString, Xpub } from "../../basic";

import { CoinTransfer } from "../funding";
import { singleAssetTwoPartyCoinTransferEncoding, tidy } from "../misc";

export const FAST_SIGNED_TRANSFER = "FAST_SIGNED_TRANSFER";
export const FastSignedTransferApp = "FastSignedTransferApp";

////////////////////////////////////////
// keep synced w contracts/app/FastSignedTransferApp.sol

export enum FastSignedTransferActionType {
  CREATE = 0,
  UNLOCK = 1,
  REJECT = 2,
}

export type FastSignedTransferAppState = {
  recipientXpub: Xpub;
  amount: DecString;
  signer: Address;
  paymentId: HexString;
  coinTransfers: [CoinTransfer, CoinTransfer];
  turnNum: HexString;
};

export const FastSignedTransferAppStateEncoding = tidy(`tuple(
  string recipientXpub,
  uint256 amount,
  address signer,
  bytes32 paymentId,
  ${singleAssetTwoPartyCoinTransferEncoding} coinTransfers,
  uint256 turnNum
)`);

export type FastSignedTransferAppAction = {
  recipientXpub: Xpub;
  amount: DecString;
  signer: Address;
  paymentId: HexString;
  data: HexString;
  signature: string;
  actionType: FastSignedTransferActionType;
};

export const FastSignedTransferAppActionEncoding = tidy(`tuple(
  string recipientXpub,
  uint256 amount,
  address signer,
  bytes32 paymentId,
  bytes32 data,
  bytes signature,
  uint256 actionType
)`);

////////////////////////////////////////
// Off-chain app types

export type FastSignedTransferParameters = {
  conditionType: typeof FAST_SIGNED_TRANSFER;
  recipient: string; // xpub?
  amount: DecString;
  assetId?: Address;
  paymentId: HexString;
  maxAllocation?: HexString;
  signer: string; // address?
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
