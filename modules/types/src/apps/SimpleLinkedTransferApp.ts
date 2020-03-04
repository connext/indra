import { CoinTransfer } from "../";
import { BigNumber } from "ethers/utils";
import { singleAssetTwoPartyCoinTransferEncoding } from "../contracts";

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

////// Transfer types
export const LINKED_TRANSFER = "LINKED_TRANSFER";
export const LINKED_TRANSFER_TO_RECIPIENT = "LINKED_TRANSFER_TO_RECIPIENT";

// linked transfer types
export type LinkedTransferParameters<T = string> = {
  conditionType: typeof LINKED_TRANSFER;
  amount: T;
  assetId?: string;
  paymentId: string;
  preImage: string;
  meta?: object;
};
export type LinkedTransferParametersBigNumber = LinkedTransferParameters<BigNumber>;

export type LinkedTransferResponse = {
  paymentId: string;
  preImage: string;
  meta?: object;
};

export type LinkedTransferToRecipientParameters<T = string> = Omit<
  LinkedTransferParameters<T>,
  "conditionType"
> & {
  conditionType: typeof LINKED_TRANSFER_TO_RECIPIENT;
  recipient: string;
};
export type LinkedTransferToRecipientParametersBigNumber = LinkedTransferToRecipientParameters<
  BigNumber
>;
export type LinkedTransferToRecipientResponse = LinkedTransferResponse & {
  recipient: string;
};

export type ResolveLinkedTransferParameters<T = string> = Omit<
  LinkedTransferParameters<T>,
  "amount" | "assetId" | "meta"
>;
export type ResolveLinkedTransferParametersBigNumber = ResolveLinkedTransferParameters<BigNumber>;

export type ResolveLinkedTransferToRecipientParameters<T = string> = Omit<
  ResolveLinkedTransferParameters<T>,
  "recipient" | "conditionType"
> & {
  amount: T;
  assetId: string;
  conditionType: typeof LINKED_TRANSFER_TO_RECIPIENT;
};

export type ResolveLinkedTransferToRecipientParametersBigNumber = ResolveLinkedTransferToRecipientParameters<
  BigNumber
>;

export type ResolveLinkedTransferResponse = {
  appId: string;
  sender: string;
  paymentId: string;
  meta?: object;
};

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
