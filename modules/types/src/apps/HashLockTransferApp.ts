import { CoinTransfer } from "../";
import { BigNumber } from "ethers/utils";
import { singleAssetTwoPartyCoinTransferEncoding } from "../contracts";

// TODO: combine?
// App Registry Name
export const HashLockTransferApp = "HashLockTransferApp";

// Transfer Condition Name
export const HASHLOCK_TRANSFER = "HASHLOCK_TRANSFER";

// Client Controller Params
export type HashLockTransferParameters<T = string> = {
  conditionType: typeof HASHLOCK_TRANSFER;
  amount: T;
  preImage: string;
  assetId?: string;
  meta?: object;
};

// Client Controller Response
export type HashLockTransferResponse = {
  appId: string;
};

// Client Resolve Params
export type ResolveHashLockTransferParameters = {
  conditionType: typeof HASHLOCK_TRANSFER;
  preImage: string;
};

// Client Resolve Response
export type ResolveHashLockTransferResponse<T = string> = {
  appId: string;
  sender: string;
  amount: T;
  assetId: string;
  meta?: object;
};
export type ResolveHashLockTransferResponseBigNumber = ResolveHashLockTransferResponse<BigNumber>;

// ABI Encodings
export const HashLockTransferAppStateEncoding = `
  tuple(
    ${singleAssetTwoPartyCoinTransferEncoding} coinTransfers,
    bytes32 lockHash,
    bytes32 preImage,
    uint256 turnNum,
    bool finalized
  )
`;
export const HashLockTransferAppActionEncoding = `tuple(bytes32 preImage)`;

// ABI Encoding TS Types
export type HashLockTransferAppState<T = string> = {
  coinTransfers: CoinTransfer<T>[];
  lockHash: string;
  preImage: string;
  turnNum: T;
  finalized: boolean;
};
export type HashLockTransferAppStateBigNumber = HashLockTransferAppState<BigNumber>;
export type HashLockTransferAppAction = {
  preImage: string;
};
