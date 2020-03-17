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

export * from "./common";
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
