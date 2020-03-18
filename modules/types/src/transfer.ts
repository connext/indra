import { BigNumber } from "./basic";
import { ConditionalTransferTypes } from "./contracts";

export type TransferAction = {
  finalize: boolean;
  transferAmount: BigNumber;
};

export type CreatedLinkedTransferMeta = {};

export type CreatedLinkedTransferToRecipientMeta = {
  encryptedPreImage: string;
};

export type CreatedFastSignedTransferMeta = {
  signer: string;
};

export type ReceiveTransferFinishedEventData<T extends ConditionalTransferTypes> = {
  amount: BigNumber;
  assetId: string;
  paymentId: string;
  sender: string;
  recipient?: string;
  meta: any;
  type: T;
};

export type CreateTransferEventData<T extends ConditionalTransferTypes> = {
  amount: BigNumber;
  assetId: string;
  paymentId: string;
  sender: string;
  recipient?: string;
  meta: any;
  type: T;
  transferMeta: T extends typeof ConditionalTransferTypes.LinkedTransfer
    ? CreatedLinkedTransferMeta
    : T extends typeof ConditionalTransferTypes.LinkedTransferToRecipient
    ? CreatedLinkedTransferToRecipientMeta
    : T extends typeof ConditionalTransferTypes.FastSignedTransfer
    ? CreatedFastSignedTransferMeta
    : undefined;
};
