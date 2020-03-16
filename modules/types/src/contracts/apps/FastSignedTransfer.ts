import { defaultAbiCoder } from "ethers/utils";
import { Address, BigNumber, HexString, Xpub } from "../../basic";

import { CoinTransfer } from "../funding";
import {
  singleAssetTwoPartyCoinTransferEncoding,
  tidy,
} from "../misc";

import { FastSignedTransfer } from "./common";

export const FastSignedTransferAppName = "FastSignedTransferApp";

////////////////////////////////////////
// keep synced w contracts/app/FastSignedTransferApp.sol

export enum FastSignedTransferActionType {
  CREATE = 0,
  UNLOCK = 1,
  REJECT = 2,
}

export type FastSignedTransferAppState = {
  recipientXpub: Xpub;
  amount: BigNumber;
  signer: Address;
  paymentId: HexString;
  coinTransfers: [CoinTransfer, CoinTransfer];
  turnNum: BigNumber;
};

export const FastSignedTransferAppStateEncoding = tidy(`tuple(
  string recipientXpub,
  uint256 amount,
  address signer,
  bytes32 paymentId,
  ${singleAssetTwoPartyCoinTransferEncoding} coinTransfers,
  uint256 turnNum
)`);

export const decodeFastSignedTransferAppState =
  (encoded: HexString): FastSignedTransferAppState =>
    defaultAbiCoder.decode([FastSignedTransferAppStateEncoding], encoded)[0];

export const encodeFastSignedTransferAppState =
  (decoded: FastSignedTransferAppState): HexString =>
    defaultAbiCoder.encode([FastSignedTransferAppStateEncoding], [decoded]);

export type FastSignedTransferAppAction = {
  recipientXpub: Xpub;
  amount: BigNumber;
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

export const decodeFastSignedTransferAppAction =
  (encoded: HexString): FastSignedTransferAppAction =>
    defaultAbiCoder.decode([FastSignedTransferAppActionEncoding], encoded)[0];

export const encodeFastSignedTransferAppAction =
  (decoded: FastSignedTransferAppAction): HexString =>
    defaultAbiCoder.encode([FastSignedTransferAppActionEncoding], [decoded]);

////////////////////////////////////////
// Off-chain app types

export type FastSignedTransferParameters = {
  conditionType: typeof FastSignedTransfer;
  recipient: string; // xpub?
  amount: BigNumber;
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
  conditionType: typeof FastSignedTransfer;
  paymentId: string;
  data: string;
  signature: string;
};

export type ResolveFastSignedTransferResponse = {
  appId: string;
  sender: string;
  paymentId: string;
  amount: BigNumber;
  assetId: string;
  signer: string;
  meta?: object;
};
