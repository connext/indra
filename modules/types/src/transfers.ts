import { Address, BigNumber, Bytes32, SignatureString } from "./basic";
import { enumify } from "./utils";
import {
  GenericConditionalTransferAppName,
  GraphBatchedTransferAppName,
  GraphSignedTransferAppName,
  HashLockTransferAppName,
  OnlineLinkedTransferAppName,
  SimpleLinkedTransferAppName,
  SimpleSignedTransferAppName,
} from "./contracts";

////////////////////////////////////////
// Types

export const ConditionalTransferTypes = enumify({
  GraphBatchedTransfer: GraphBatchedTransferAppName,
  GraphTransfer: GraphSignedTransferAppName,
  HashLockTransfer: HashLockTransferAppName,
  LinkedTransfer: SimpleLinkedTransferAppName,
  OnlineTransfer: OnlineLinkedTransferAppName,
  SignedTransfer: SimpleSignedTransferAppName,
});
export type ConditionalTransferTypes = typeof ConditionalTransferTypes[
  keyof typeof ConditionalTransferTypes
];

export const ConditionalTransferAppNames = enumify({
  [GenericConditionalTransferAppName]: GenericConditionalTransferAppName,
  [GraphBatchedTransferAppName]: GraphBatchedTransferAppName,
  [GraphSignedTransferAppName]: GraphSignedTransferAppName,
  [HashLockTransferAppName]: HashLockTransferAppName,
  [OnlineLinkedTransferAppName]: OnlineLinkedTransferAppName,
  [SimpleLinkedTransferAppName]: SimpleLinkedTransferAppName,
  [SimpleSignedTransferAppName]: SimpleSignedTransferAppName,
});
export type ConditionalTransferAppNames = typeof ConditionalTransferAppNames[
  keyof typeof ConditionalTransferAppNames
];

////////////////////////////////////////
// Metadata

export interface CreatedConditionalTransferMetaMap {
  [ConditionalTransferTypes.GraphBatchedTransfer]: CreatedGraphBatchedTransferMeta;
  [ConditionalTransferTypes.GraphTransfer]: CreatedGraphSignedTransferMeta;
  [ConditionalTransferTypes.HashLockTransfer]: CreatedHashLockTransferMeta;
  [ConditionalTransferTypes.LinkedTransfer]: CreatedLinkedTransferMeta;
  [ConditionalTransferTypes.OnlineTransfer]: CreatedLinkedTransferMeta;
  [ConditionalTransferTypes.SignedTransfer]: CreatedSignedTransferMeta;
}
export type CreatedConditionalTransferMeta = {
  [P in keyof CreatedConditionalTransferMetaMap]: CreatedConditionalTransferMetaMap[P];
};

export interface UnlockedConditionalTransferMetaMap {
  [ConditionalTransferTypes.GraphBatchedTransfer]: UnlockedGraphBatchedTransferMeta;
  [ConditionalTransferTypes.GraphTransfer]: UnlockedGraphSignedTransferMeta;
  [ConditionalTransferTypes.HashLockTransfer]: UnlockedHashLockTransferMeta;
  [ConditionalTransferTypes.LinkedTransfer]: UnlockedLinkedTransferMeta;
  [ConditionalTransferTypes.OnlineTransfer]: UnlockedLinkedTransferMeta;
  [ConditionalTransferTypes.SignedTransfer]: UnlockedSignedTransferMeta;
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
};

export type CreatedGraphSignedTransferMeta = {
  signerAddress: Address;
  chainId: number;
  verifyingContract: Address;
  requestCID: Bytes32;
  subgraphDeploymentID: Bytes32;
};

export type CreatedGraphBatchedTransferMeta = {
  chainId: number;
  verifyingContract: Address;
  subgraphDeploymentID: Bytes32;
  swapRate: BigNumber;
  attestationSigner: Address;
  consumerSigner: Address;
};

export type UnlockedLinkedTransferMeta = {
  preImage: string;
};

export type UnlockedHashLockTransferMeta = {
  lockHash: Bytes32;
  preImage: Bytes32;
};

export type UnlockedGraphBatchedTransferMeta = {
  requestCID: Bytes32;
  responseCID: Bytes32;
  totalPaid: BigNumber;
  attestationSignature: SignatureString;
  consumerSignature: SignatureString;
};

export type UnlockedGraphSignedTransferMeta = {
  responseCID: Bytes32;
  signature: SignatureString;
};

export type UnlockedSignedTransferMeta = {
  data: Bytes32;
  signature: SignatureString;
};

////////////////////////////////////////
// Statuses

export const TransferStatuses = {
  PENDING: "PENDING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
} as const;
export const TransferWithExpiryStatuses = {
  ...TransferStatuses,
  EXPIRED: "EXPIRED",
} as const;
export type TransferWithExpiryStatus = typeof TransferWithExpiryStatuses[
  keyof typeof TransferWithExpiryStatuses
];
export type TransferStatus = typeof TransferStatuses[keyof Omit<
  typeof TransferStatuses,
  "EXPIRED"
>];

// Type Aliases
export const LinkedTransferStatus = TransferStatuses;
export type LinkedTransferStatus = TransferStatus;

export const HashLockTransferStatus = TransferWithExpiryStatuses;
export type HashLockTransferStatus = TransferWithExpiryStatus;

export const SignedTransferStatus = TransferStatuses;
export type SignedTransferStatus = TransferStatus;

export const GraphSignedTransferStatus = TransferStatuses;
export type GraphSignedTransferStatus = TransferStatus;

////////////////////////////////////////
// Misc

export type TransferAction = {
  finalize: boolean;
  transferAmount: BigNumber;
};
