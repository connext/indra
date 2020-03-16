export const FastSignedTransfer = "FAST_SIGNED_TRANSFER";
export const LinkedTransfer = "LINKED_TRANSFER";
export const LinkedTransferToRecipient = "LINKED_TRANSFER_TO_RECIPIENT";

export const ConditionalTransferTypes = {
  [FastSignedTransfer]: FastSignedTransfer,
  [LinkedTransfer]: LinkedTransfer,
  [LinkedTransferToRecipient]: LinkedTransferToRecipient,
};

export type ConditionalTransferType = keyof typeof ConditionalTransferTypes;
