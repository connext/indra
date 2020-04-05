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
export * from "./DepositApp";
export * from "./common";
export * from "./HashLockTransferApp";
export * from "./SimpleLinkedTransferApp";
export * from "./SimpleTwoPartySwapApp";
export * from "./WithdrawApp";
export * from "./SimpleSignedTransferApp";

export type ConditionalTransferParameters =
  | LinkedTransferParameters
  | HashLockTransferParameters
  | SignedTransferParameters;

export type ConditionalTransferResponse =
  | LinkedTransferResponse
  | HashLockTransferResponse
  | SignedTransferResponse;

export type ResolveConditionParameters =
  | ResolveHashLockTransferParameters
  | ResolveLinkedTransferParameters
  | ResolveSignedTransferParameters;

export type ResolveConditionResponse =
  | ResolveHashLockTransferResponse
  | ResolveLinkedTransferResponse
  | ResolveSignedTransferResponse;
