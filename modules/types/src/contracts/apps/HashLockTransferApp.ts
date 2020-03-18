import { BigNumber } from "ethers/utils";

import { CoinTransfer } from "../funding";
import {
  singleAssetTwoPartyCoinTransferEncoding,
  tidy,
} from "../misc";

import { HashLockTransfer } from "./common";

export const HashLockTransferAppName = "HashLockTransferApp";

////////////////////////////////////////
// keep synced w contracts/app/HashLockTransferApp.sol

// ABI Encoding TS Types
export type HashLockTransferAppState = {
  coinTransfers: CoinTransfer[];
  lockHash: string;
  preImage: string;
  turnNum: BigNumber;
  finalized: boolean;
};

// ABI Encodings
export const HashLockTransferAppStateEncoding = tidy(`tuple(
  ${singleAssetTwoPartyCoinTransferEncoding} coinTransfers,
  bytes32 lockHash,
  bytes32 preImage,
  uint256 turnNum,
  bool finalized
)`);

export type HashLockTransferAppAction = {
  preImage: string;
};

export const HashLockTransferAppActionEncoding = `tuple(bytes32 preImage)`;

////////////////////////////////////////
// Off-chain app types

// Client Controller Params
export type HashLockTransferParameters = {
  conditionType: typeof HashLockTransfer;
  amount: BigNumber;
  preImage: string;
  assetId?: string;
  meta?: object;
};

// Client Controller Response
export type HashLockTransferResponse = {
  appId: string;
  preImage: string;
};

// Client Resolve Params
export type ResolveHashLockTransferParameters = {
  conditionType: typeof HashLockTransfer;
  preImage: string;
};

// Client Resolve Response
export type ResolveHashLockTransferResponse = {
  appId: string;
  sender: string;
  amount: BigNumber;
  assetId: string;
  meta?: object;
};
