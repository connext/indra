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
  assetId?: string;
  paymentId: string;
  preImage: string;
  meta?: object;
};

// Client Controller Response
export type HashLockTransferResponse = {
  paymentId: string;
  preImage: string;
  meta?: object;
};

// Client Resolve Params
export type ResolveHashLockTransferParameters = {
  paymentId: string;
  preImage: string;
};

// Client Resolve Response
export type ResolveHashLockTransferResponse<T = string> = {
  appId: string;
  sender: string;
  paymentId: string;
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
  linkedHash: string;
  amount: T;
  assetId: string;
  paymentId: string;
  preImage: string;
};
export type HashLockTransferAppStateBigNumber = HashLockTransferAppState<BigNumber>;
export type HashLockTransferAppAction = {
  preImage: string;
};
