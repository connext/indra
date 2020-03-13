import {
  ResolveLinkedTransferResponse,
  LinkedTransferParameters,
  LinkedTransferToRecipientParameters,
  LinkedTransferResponse,
  LinkedTransferToRecipientResponse,
  ResolveLinkedTransferParameters,
  ResolveLinkedTransferToRecipientParameters,
  LINKED_TRANSFER,
  LINKED_TRANSFER_TO_RECIPIENT,
} from "./SimpleLinkedTransferApp";
import {
  FastSignedTransferParameters,
  FastSignedTransferResponse,
  ResolveFastSignedTransferParameters,
  FAST_SIGNED_TRANSFER,
  ResolveFastSignedTransferResponse,
} from "./FastSignedTransfer";
import {
  HashLockTransferParameters,
  HashLockTransferResponse,
  ResolveHashLockTransferParameters,
  ResolveHashLockTransferResponse,
} from "./HashLockTransferApp";
export * from "./CoinBalanceRefundApp";
export * from "./FastSignedTransfer";
export * from "./HashLockTransferApp";
export * from "./SimpleLinkedTransferApp";
export * from "./SimpleTwoPartySwapApp";

export type ConditionalTransferParameters =
  | LinkedTransferParameters
  | LinkedTransferToRecipientParameters
  | FastSignedTransferParameters
  | HashLockTransferParameters;

export type ConditionalTransferResponse =
  | LinkedTransferResponse
  | LinkedTransferToRecipientResponse
  | FastSignedTransferResponse
  | HashLockTransferResponse;

export type ResolveConditionParameters =
  | ResolveLinkedTransferParameters
  | ResolveLinkedTransferToRecipientParameters
  | ResolveFastSignedTransferParameters
  | ResolveHashLockTransferParameters;
export type ResolveConditionResponse =
  | ResolveLinkedTransferResponse
  | ResolveFastSignedTransferResponse
  | ResolveHashLockTransferResponse;

export type ConditionalTransferTypes =
  | typeof LINKED_TRANSFER
  | typeof LINKED_TRANSFER_TO_RECIPIENT
  | typeof FAST_SIGNED_TRANSFER;
