import {
  FastSignedTransferParameters,
  FastSignedTransferResponse,
  ResolveFastSignedTransferParameters,
  ResolveFastSignedTransferResponse,
} from "./FastSignedTransfer";
import {
  HashLockTransferParameters,
  HashLockTransferResponse,
  ResolveHashLockTransferParameters,
  ResolveHashLockTransferResponse,
} from "./HashLockTransferApp";
import {
  LinkedTransferParameters,
  LinkedTransferResponse,
  ResolveLinkedTransferParameters,
  ResolveLinkedTransferResponse,
} from "./SimpleLinkedTransferApp";

export * from "./CoinBalanceRefundApp";
export * from "./common";
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
