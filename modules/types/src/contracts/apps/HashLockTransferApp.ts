import { BigNumber } from "ethers";

import { Bytes32 } from "../../basic";
import { tidy } from "../../utils";

import { CoinTransfer } from "../funding";
import { singleAssetTwoPartyCoinTransferEncoding } from "../misc";

export const HashLockTransferAppName = "HashLockTransferApp";

////////////////////////////////////////
// keep synced w contracts/app/HashLockTransferApp.sol

// ABI Encoding TS Types
export type HashLockTransferAppState = {
  coinTransfers: CoinTransfer[];
  lockHash: Bytes32;
  preImage: Bytes32;
  expiry: BigNumber;
  finalized: boolean;
};

// ABI Encodings
export const HashLockTransferAppStateEncoding = tidy(`tuple(
  ${singleAssetTwoPartyCoinTransferEncoding} coinTransfers,
  bytes32 lockHash,
  bytes32 preImage,
  uint256 expiry,
  bool finalized
)`);

export type HashLockTransferAppAction = {
  preImage: Bytes32;
};

export const HashLockTransferAppActionEncoding = tidy(`tuple(
  bytes32 preImage
)`);
