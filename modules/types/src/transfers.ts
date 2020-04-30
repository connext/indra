import { Address, BigNumber, Bytes32 } from "./basic";
import { enumify } from "./utils";

////////////////////////////////////////
// Types

export const ConditionalTransferTypes = enumify({
  HashLockTransfer: "HashLockTransfer",
  LinkedTransfer: "LinkedTransfer",
  SignedTransfer: "SignedTransfer",
});
export type ConditionalTransferTypes =
  (typeof ConditionalTransferTypes)[keyof typeof ConditionalTransferTypes];

////////////////////////////////////////
// Metadata

export type CreatedLinkedTransferMeta = {
  encryptedPreImage?: string;
};

export type CreatedHashLockTransferMeta = {
  lockHash: Bytes32;
  timelock?: BigNumber;
  expiry: BigNumber;
};

export type CreatedSignedTransferMeta = {
  signer: Address;
};

export type UnlockedLinkedTransferMeta = {
  preImage: string;
};

export type UnlockedHashLockTransferMeta = {
  lockHash: Bytes32;
  preImage: Bytes32;
};

export type UnlockedSignedTransferMeta = {};

////////////////////////////////////////
// Statuses

export const LinkedTransferStatus = enumify({
  PENDING: "PENDING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
});
export type LinkedTransferStatus =
  (typeof LinkedTransferStatus)[keyof typeof LinkedTransferStatus];

export const HashLockTransferStatus = enumify({
  PENDING: "PENDING",
  EXPIRED: "EXPIRED",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
});
export type HashLockTransferStatus =
  (typeof HashLockTransferStatus)[keyof typeof HashLockTransferStatus];

export const SignedTransferStatus = enumify({
  PENDING: "PENDING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
});
export type SignedTransferStatus =
  (typeof SignedTransferStatus)[keyof typeof SignedTransferStatus];

////////////////////////////////////////
// Misc

export type TransferAction = {
  finalize: boolean;
  transferAmount: BigNumber;
};
