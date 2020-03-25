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
  timelock: T;
  lockHash: string;
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

// statuses
export const enum HashLockTransferStatus {
  PENDING = "PENDING",
  EXPIRED = "EXPIRED",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

// Getter
export type GetHashLockTransferResponse =
  | {
      senderPublicIdentifier: string;
      receiverPublicIdentifier?: string;
      assetId: string;
      amount: string;
      lockHash: string;
      status: HashLockTransferStatus;
      meta?: any;
    }
  | undefined;

// ABI Encodings
export const HashLockTransferAppStateEncoding = `
  tuple(
    ${singleAssetTwoPartyCoinTransferEncoding} coinTransfers,
    bytes32 lockHash,
    bytes32 preImage,
    uint256 timelock,
    bool finalized
  )
`;
export const HashLockTransferAppActionEncoding = `tuple(bytes32 preImage)`;

// ABI Encoding TS Types
export type HashLockTransferAppState<T = string> = {
  coinTransfers: CoinTransfer<T>[];
  lockHash: string;
  preImage: string;
  timelock: T;
  finalized: boolean;
};
export type HashLockTransferAppStateBigNumber = HashLockTransferAppState<BigNumber>;
export type HashLockTransferAppAction = {
  preImage: string;
};

// Event Data
export type CreatedLinkedTransferMeta = {
  encryptedPreImage?: string;
};
