import { BigNumber, BigNumberish } from "ethers/utils";

import { Address, Bytes32, DecString, Xpub } from "../../basic";
import { enumify } from "../../utils";

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
  lockHash: Bytes32;
  preImage: Bytes32;
  timelock: BigNumber;
  finalized: boolean;
};

// ABI Encodings
export const HashLockTransferAppStateEncoding = tidy(`tuple(
  ${singleAssetTwoPartyCoinTransferEncoding} coinTransfers,
  bytes32 lockHash,
  bytes32 preImage,
  uint256 timelock,
  bool finalized
)`);

export type HashLockTransferAppAction = {
  preImage: Bytes32;
};

export const HashLockTransferAppActionEncoding = tidy(`tuple(
  bytes32 preImage
)`);

////////////////////////////////////////
// Off-chain app types

// statuses
export const HashLockTransferStatus = enumify({
  PENDING: "PENDING",
  EXPIRED: "EXPIRED",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
});
export type HashLockTransferStatus =
  (typeof HashLockTransferStatus)[keyof typeof HashLockTransferStatus];

// Client Controller Params
export type HashLockTransferParameters = {
  conditionType: typeof HashLockTransfer;
  amount: BigNumberish;
  timelock: BigNumberish;
  lockHash: Bytes32;
  recipient: Xpub;
  assetId?: Address;
  meta?: object;
};

// Client Controller Response
export type HashLockTransferResponse = {
  appId: Bytes32;
};

// Client Resolve Params
export type ResolveHashLockTransferParameters = {
  conditionType: typeof HashLockTransfer;
  preImage: Bytes32;
};

// Client Resolve Response
export type ResolveHashLockTransferResponse = {
  appId: Bytes32;
  sender: Xpub;
  amount: BigNumber;
  assetId: Address;
  meta?: object;
};

// Getter
export type GetHashLockTransferResponse =
  | {
      senderPublicIdentifier: Xpub;
      receiverPublicIdentifier?: Xpub;
      assetId: Address;
      amount: DecString;
      lockHash: Bytes32;
      status: HashLockTransferStatus;
      meta?: any;
    }
  | undefined;

// Event Data
export type CreatedHashLockTransferMeta = {
  lockHash: Bytes32;
};
