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
import {
  SignedTransferParameters,
  SignedTransferResponse,
  ResolveSignedTransferParameters,
  ResolveSignedTransferResponse,
  SIGNED_TRANSFER,
} from "./SimpleSignedTransferApp";
export * from "./CoinBalanceRefundApp";
export * from "./FastSignedTransfer";
export * from "./HashLockTransferApp";
export * from "./SimpleLinkedTransferApp";
export * from "./SimpleTwoPartySwapApp";
export * from "./WithdrawApp";
export * from "./SimpleSignedTransferApp";

export type ConditionalTransferParameters =
  | LinkedTransferParameters
  | FastSignedTransferParameters
  | HashLockTransferParameters
  | SignedTransferParameters;

export type ConditionalTransferResponse =
  | LinkedTransferResponse
  | FastSignedTransferResponse
  | HashLockTransferResponse
  | SignedTransferResponse;

export type ResolveConditionParameters =
  | ResolveLinkedTransferParameters
  | ResolveFastSignedTransferParameters
  | ResolveHashLockTransferParameters
  | ResolveSignedTransferParameters;
export type ResolveConditionResponse =
  | ResolveLinkedTransferResponse
  | ResolveFastSignedTransferResponse
  | ResolveHashLockTransferResponse
  | ResolveSignedTransferResponse;

export type ConditionalTransferTypes =
  | typeof LINKED_TRANSFER
  | typeof FAST_SIGNED_TRANSFER
  | typeof HASHLOCK_TRANSFER
  | typeof SIGNED_TRANSFER;
