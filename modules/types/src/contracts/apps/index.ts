import {
  FastSignedTransferAppAction,
  FastSignedTransferAppState,
  FastSignedTransferParameters,
  FastSignedTransferResponse,
  ResolveFastSignedTransferParameters,
} from "./FastSignedTransfer";
import {
  SimpleLinkedTransferAppAction,
  SimpleLinkedTransferAppState,
  ResolveLinkedTransferResponse,
  LinkedTransferParameters,
  LinkedTransferToRecipientParameters,
  LinkedTransferResponse,
  LinkedTransferToRecipientResponse,
  ResolveLinkedTransferParameters,
  ResolveLinkedTransferToRecipientParameters,
} from "./SimpleLinkedTransferApp";
import { SimpleSwapAppState }from "./SimpleTwoPartySwapApp";

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

export type AppAction =
  | FastSignedTransferAppAction
  | SimpleLinkedTransferAppAction
  | SimpleSwapAppState;

export type AppState = 
  | FastSignedTransferAppState
  | SimpleLinkedTransferAppState;
