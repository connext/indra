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
import {
  SignedTransferParameters,
  SignedTransferResponse,
  ResolveSignedTransferParameters,
  ResolveSignedTransferResponse,
} from "./SimpleSignedTransferApp";
export * from "./CoinBalanceRefundApp";
export * from "./common";
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
  | ResolveFastSignedTransferParameters
  | ResolveHashLockTransferParameters
  | ResolveLinkedTransferParameters
  | ResolveSignedTransferParameters;

export type ResolveConditionResponse =
  | ResolveFastSignedTransferResponse
  | ResolveHashLockTransferResponse
  | ResolveLinkedTransferResponse
  | ResolveSignedTransferResponse
