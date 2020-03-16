import { DecString } from "./basic";
import {
  LinkedTransfer,
  LinkedTransferToRecipient,
  FastSignedTransfer,
  ConditionalTransferType,
} from "./contracts";

export type TransferAction = {
  finalize: boolean;
  transferAmount: DecString;
};

export type CreatedLinkedTransferMeta = {};

export type CreatedLinkedTransferToRecipientMeta = {
  encryptedPreImage: string;
};

export type CreatedFastSignedTransferMeta = {
  signer: string;
};

export type ReceiveTransferFinishedEventData<
  T extends ConditionalTransferType | undefined = undefined
> = {
  amount: string;
  assetId: string;
  paymentId: string;
  sender: string;
  recipient?: string;
  meta: any;
  type: T;
};

export type CreateTransferEventData<T extends ConditionalTransferType | undefined = undefined> = {
  amount: string;
  assetId: string;
  paymentId: string;
  sender: string;
  recipient?: string;
  meta: any;
  type: T;
  transferMeta: T extends typeof LinkedTransfer
    ? CreatedLinkedTransferMeta
    : T extends typeof LinkedTransferToRecipient
    ? CreatedLinkedTransferToRecipientMeta
    : T extends typeof FastSignedTransfer
    ? CreatedFastSignedTransferMeta
    : undefined;
};
