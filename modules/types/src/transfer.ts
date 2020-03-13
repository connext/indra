import {
  LINKED_TRANSFER,
  LINKED_TRANSFER_TO_RECIPIENT,
  FAST_SIGNED_TRANSFER,
  ConditionalTransferTypes,
} from "./contracts";

export type CreatedLinkedTransferMeta = {};
export type CreatedLinkedTransferToRecipientMeta = {
  encryptedPreImage: string;
};
export type CreatedFastSignedTransferMeta = {
  signer: string;
};

export type ReceiveTransferFinishedEventData<
  T extends ConditionalTransferTypes | undefined = undefined
> = {
  amount: string;
  assetId: string;
  paymentId: string;
  sender: string;
  recipient?: string;
  meta: any;
  type: T;
};

export type CreateTransferEventData<T extends ConditionalTransferTypes | undefined = undefined> = {
  amount: string;
  assetId: string;
  paymentId: string;
  sender: string;
  recipient?: string;
  meta: any;
  type: T;
  transferMeta: T extends typeof LINKED_TRANSFER
    ? CreatedLinkedTransferMeta
    : T extends typeof LINKED_TRANSFER_TO_RECIPIENT
    ? CreatedLinkedTransferToRecipientMeta
    : T extends typeof FAST_SIGNED_TRANSFER
    ? CreatedFastSignedTransferMeta
    : undefined;
};
