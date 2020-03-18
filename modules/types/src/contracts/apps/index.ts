import {
  FastSignedTransferParameters,
  FastSignedTransferResponse,
  ResolveFastSignedTransferParameters,
} from "./FastSignedTransfer";
import {
  ResolveLinkedTransferResponse,
  LinkedTransferParameters,
  LinkedTransferToRecipientParameters,
  LinkedTransferResponse,
  LinkedTransferToRecipientResponse,
  ResolveLinkedTransferParameters,
  ResolveLinkedTransferToRecipientParameters,
} from "./SimpleLinkedTransferApp";
<<<<<<< HEAD:modules/types/src/contracts/apps/index.ts

export * from "./common";
=======
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
>>>>>>> 845-store-refactor:modules/types/src/apps/index.ts
export * from "./FastSignedTransfer";
export * from "./HashLockTransferApp";
export * from "./SimpleLinkedTransferApp";
export * from "./SimpleTwoPartySwapApp";
export * from "./WithdrawApp";

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
<<<<<<< HEAD:modules/types/src/contracts/apps/index.ts
  | ResolveFastSignedTransferParameters;

export type ResolveConditionResponse = ResolveLinkedTransferResponse;
=======
  | ResolveFastSignedTransferParameters
  | ResolveHashLockTransferParameters;
export type ResolveConditionResponse =
  | ResolveLinkedTransferResponse
  | ResolveFastSignedTransferResponse
  | ResolveHashLockTransferResponse;

export type ConditionalTransferTypes =
  | typeof LINKED_TRANSFER
  | typeof LINKED_TRANSFER_TO_RECIPIENT
  | typeof FAST_SIGNED_TRANSFER
  | typeof HASHLOCK_TRANSFER;
>>>>>>> 845-store-refactor:modules/types/src/apps/index.ts
