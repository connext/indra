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
} from "./FastSignedTransfer";
export * from "./CoinBalanceRefundApp";
export * from "./FastSignedTransfer";
export * from "./SimpleLinkedTransferApp";
export * from "./SimpleTwoPartySwapApp";
export * from "./WithdrawApp";

export type ConditionalTransferParameters =
  | LinkedTransferParameters
  | LinkedTransferToRecipientParameters
  | FastSignedTransferParameters;

export type ConditionalTransferResponse =
  | LinkedTransferResponse
  | LinkedTransferToRecipientResponse
  | FastSignedTransferResponse;

export type ResolveConditionParameters =
  | ResolveLinkedTransferParameters
  | ResolveLinkedTransferToRecipientParameters
  | ResolveFastSignedTransferParameters;
export type ResolveConditionResponse = ResolveLinkedTransferResponse;

export type ConditionalTransferTypes =
  | typeof LINKED_TRANSFER
  | typeof LINKED_TRANSFER_TO_RECIPIENT
  | typeof FAST_SIGNED_TRANSFER;