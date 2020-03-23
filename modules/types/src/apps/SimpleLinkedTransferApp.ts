import { CoinTransfer } from "../";
import { BigNumber } from "ethers/utils";
import { singleAssetTwoPartyCoinTransferEncoding } from "../contracts";

// App Registry Name
export const SimpleLinkedTransferApp = "SimpleLinkedTransferApp";

// Transfer Condition Name
export const LINKED_TRANSFER = "LINKED_TRANSFER";

// Client Controller Params
export type LinkedTransferParameters<T = string> = {
  conditionType: typeof LINKED_TRANSFER;
  amount: T;
  assetId?: string;
  paymentId: string;
  preImage: string;
  recipient?: string;
  meta?: any;
};
export type LinkedTransferParametersBigNumber = LinkedTransferParameters<BigNumber>;

// Client Controller Response
export type LinkedTransferResponse = {
  appId: string;
  paymentId: string;
  preImage: string;
};

// Client Resolve Params
export type ResolveLinkedTransferParameters = {
  conditionType: typeof LINKED_TRANSFER;
  paymentId: string;
  preImage: string;
};

// Client Resolve Response
export type ResolveLinkedTransferResponse<T = string> = {
  appId: string;
  sender: string;
  paymentId: string;
  amount: T;
  assetId: string;
  meta?: object;
};
export type ResolveLinkedTransferResponseBigNumber = ResolveLinkedTransferResponse<BigNumber>;

// ABI Encodings
export const SimpleLinkedTransferAppStateEncoding = `
  tuple(
    ${singleAssetTwoPartyCoinTransferEncoding} coinTransfers,
    bytes32 linkedHash,
    uint256 amount,
    address assetId,
    bytes32 paymentId,
    bytes32 preImage
  )
`;
export const SimpleLinkedTransferAppActionEncoding = `tuple(bytes32 preImage)`;

// ABI Encoding TS Types
export type SimpleLinkedTransferAppState<T = string> = {
  coinTransfers: CoinTransfer<T>[];
  linkedHash: string;
  amount: T;
  assetId: string;
  paymentId: string;
  preImage: string;
};
export type SimpleLinkedTransferAppStateBigNumber = SimpleLinkedTransferAppState<BigNumber>;
export type SimpleLinkedTransferAppAction = {
  preImage: string;
};
