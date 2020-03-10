import {
  ResolveLinkedTransferResponse,
  LinkedTransferParameters,
  LinkedTransferToRecipientParameters,
  LinkedTransferResponse,
  LinkedTransferToRecipientResponse,
  ResolveLinkedTransferParameters,
  ResolveLinkedTransferToRecipientParameters,
} from "./SimpleLinkedTransferApp";
import {
  FastSignedTransferParameters,
  FastSignedTransferResponse,
  ResolveFastSignedTransferParameters,
} from "./FastSignedTransfer";
export * from "./CoinBalanceRefundApp";
export * from "./FastSignedTransfer";
export * from "./SimpleLinkedTransferApp";
export * from "./SimpleTwoPartySwapApp";

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
