import {
  ResolveLinkedTransferResponse,
  LinkedTransferParameters,
  LinkedTransferToRecipientParameters,
  LinkedTransferResponse,
  LinkedTransferToRecipientResponse,
  ResolveLinkedTransferParameters,
  ResolveLinkedTransferToRecipientParameters,
} from "./SimpleLinkedTransferApp";
export * from "./CoinBalanceRefundApp";
export * from "./FastSignedTransfer";
export * from "./SimpleLinkedTransferApp";
export * from "./SimpleTwoPartySwapApp";

export type ConditionalTransferParameters =
  | LinkedTransferParameters
  | LinkedTransferToRecipientParameters;

export type ConditionalTransferResponse =
  | LinkedTransferResponse
  | LinkedTransferToRecipientResponse;

export type ResolveConditionParameters =
  | ResolveLinkedTransferParameters
  | ResolveLinkedTransferToRecipientParameters;
export type ResolveConditionResponse = ResolveLinkedTransferResponse;
