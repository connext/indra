import { Address, BigNumber, Bytes32, SignatureString } from "./basic";
import { enumify } from "./utils";
import {
  HashLockTransferAppName,
  SimpleLinkedTransferAppName,
  SimpleSignedTransferAppName,
  SupportedApplicationNames,
  GenericConditionalTransferAppName,
  Attestation,
} from "./contracts";

////////////////////////////////////////
// Types

const RequireOnlineAppNames: SupportedApplicationNames[] = [
  SupportedApplicationNames.HashLockTransferApp,
];
const AllowOfflineAppNames: SupportedApplicationNames[] = [
  SupportedApplicationNames.SimpleSignedTransferApp,
  SupportedApplicationNames.SimpleLinkedTransferApp,
];

export type TransferType = "RequireOnline" | "AllowOffline";
export const getTransferTypeFromAppName = (
  name: SupportedApplicationNames,
): TransferType | undefined => {
  if (RequireOnlineAppNames.includes(name)) {
    return "RequireOnline";
  }
  if (AllowOfflineAppNames.includes(name)) {
    return "AllowOffline";
  }

  return undefined;
};

export const ConditionalTransferTypes = enumify({
  HashLockTransfer: HashLockTransferAppName,
  LinkedTransfer: SimpleLinkedTransferAppName,
  SignedTransfer: SimpleSignedTransferAppName,
});
export type ConditionalTransferTypes = typeof ConditionalTransferTypes[keyof typeof ConditionalTransferTypes];

export const ConditionalTransferAppNames = enumify({
  [HashLockTransferAppName]: HashLockTransferAppName,
  [SimpleLinkedTransferAppName]: SimpleLinkedTransferAppName,
  [SimpleSignedTransferAppName]: SimpleSignedTransferAppName,
  [GenericConditionalTransferAppName]: GenericConditionalTransferAppName,
});
export type ConditionalTransferAppNames = typeof ConditionalTransferAppNames[keyof typeof ConditionalTransferAppNames];

////////////////////////////////////////
// Metadata

export interface CreatedConditionalTransferMetaMap {
  [ConditionalTransferTypes.HashLockTransfer]: CreatedHashLockTransferMeta;
  [ConditionalTransferTypes.SignedTransfer]: CreatedSignedTransferMeta;
  [ConditionalTransferTypes.LinkedTransfer]: CreatedLinkedTransferMeta;
}
export type CreatedConditionalTransferMeta = {
  [P in keyof CreatedConditionalTransferMetaMap]: CreatedConditionalTransferMetaMap[P];
};

export interface UnlockedConditionalTransferMetaMap {
  [ConditionalTransferTypes.HashLockTransfer]: UnlockedHashLockTransferMeta;
  [ConditionalTransferTypes.SignedTransfer]: UnlockedSignedTransferMeta;
  [ConditionalTransferTypes.LinkedTransfer]: UnlockedLinkedTransferMeta;
}
export type UnlockedConditionalTransferMeta = {
  [P in keyof UnlockedConditionalTransferMetaMap]: UnlockedConditionalTransferMetaMap[P];
};

export type CreatedLinkedTransferMeta = {
  encryptedPreImage?: string;
};

export type CreatedHashLockTransferMeta = {
  lockHash: Bytes32;
  timelock?: BigNumber;
  expiry: BigNumber;
};

export type CreatedSignedTransferMeta = {
  signerAddress: Address;
  chainId: number;
  verifyingContract: Address;
  requestCID: Bytes32;
  subgraphDeploymentID: Bytes32;
};

export type UnlockedLinkedTransferMeta = {
  preImage: string;
};

export type UnlockedHashLockTransferMeta = {
  lockHash: Bytes32;
  preImage: Bytes32;
};

export type UnlockedSignedTransferMeta = {
  responseCID: Bytes32;
  signature: SignatureString;
};

////////////////////////////////////////
// Statuses

export const LinkedTransferStatus = enumify({
  PENDING: "PENDING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
});
export type LinkedTransferStatus = typeof LinkedTransferStatus[keyof typeof LinkedTransferStatus];

export const HashLockTransferStatus = enumify({
  PENDING: "PENDING",
  EXPIRED: "EXPIRED",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
});
export type HashLockTransferStatus = typeof HashLockTransferStatus[keyof typeof HashLockTransferStatus];

export const SignedTransferStatus = enumify({
  PENDING: "PENDING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
});
export type SignedTransferStatus = typeof SignedTransferStatus[keyof typeof SignedTransferStatus];

////////////////////////////////////////
// Misc

export type TransferAction = {
  finalize: boolean;
  transferAmount: BigNumber;
};
