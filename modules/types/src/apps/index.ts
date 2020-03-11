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

export type ConditionalTransferTypes = {
  LINKED_TRANSFER: "LINKED_TRANSFER";
  LINKED_TRANSFER_TO_RECIPIENT: "LINKED_TRANSFER_TO_RECIPIENT";
  FAST_SIGNED_TRANSFER: "FAST_SIGNED_TRANSFER";
};

export type CreatedLinkedTransferMeta = {};
export type CreatedLinkedTransferToRecipientMeta = {
  encryptedPreImage: string;
};
export type CreatedFastSignedTransferMeta = {
  signer: string;
};

export type CreateTransferMetas = {
  LINKED_TRANSFER: CreatedLinkedTransferMeta;
  LINKED_TRANSFER_TO_RECIPIENT: CreatedLinkedTransferToRecipientMeta;
  FAST_SIGNED_TRANSFER: CreatedFastSignedTransferMeta;
};
