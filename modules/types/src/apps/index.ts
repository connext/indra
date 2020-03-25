import {
  ResolveLinkedTransferResponse,
  LinkedTransferParameters,
  LinkedTransferResponse,
  ResolveLinkedTransferParameters,
  LINKED_TRANSFER,
} from "./SimpleLinkedTransferApp";
import {
  FastSignedTransferParameters,
  FastSignedTransferResponse,
  ResolveFastSignedTransferParameters,
  FAST_SIGNED_TRANSFER,
  ResolveFastSignedTransferResponse,
} from "./FastSignedTransfer";
import {
  HASHLOCK_TRANSFER,
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
export * from "./WithdrawApp";

export type ConditionalTransferParameters =
  | LinkedTransferParameters
  | FastSignedTransferParameters
  | HashLockTransferParameters;

export type ConditionalTransferResponse =
  | LinkedTransferResponse
  | FastSignedTransferResponse
  | HashLockTransferResponse;

export type ResolveConditionParameters =
  | ResolveLinkedTransferParameters
  | ResolveFastSignedTransferParameters
  | ResolveHashLockTransferParameters;
export type ResolveConditionResponse =
  | ResolveLinkedTransferResponse
  | ResolveFastSignedTransferResponse
  | ResolveHashLockTransferResponse;

export type ConditionalTransferTypes =
  | typeof LINKED_TRANSFER
  | typeof FAST_SIGNED_TRANSFER
  | typeof HASHLOCK_TRANSFER;
