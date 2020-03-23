import {
<<<<<<< HEAD:modules/types/src/contracts/apps/index.ts
=======
  ResolveLinkedTransferResponse,
  LinkedTransferParameters,
  LinkedTransferResponse,
  ResolveLinkedTransferParameters,
  LINKED_TRANSFER,
} from "./SimpleLinkedTransferApp";
import {
>>>>>>> nats-messaging-refactor:modules/types/src/apps/index.ts
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
  LinkedTransferToRecipientParameters,
  LinkedTransferToRecipientResponse,
  ResolveLinkedTransferParameters,
  ResolveLinkedTransferResponse,
  ResolveLinkedTransferToRecipientParameters,
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
<<<<<<< HEAD:modules/types/src/contracts/apps/index.ts
=======

export type ConditionalTransferTypes =
  | typeof LINKED_TRANSFER
  | typeof FAST_SIGNED_TRANSFER
  | typeof HASHLOCK_TRANSFER;
>>>>>>> nats-messaging-refactor:modules/types/src/apps/index.ts
