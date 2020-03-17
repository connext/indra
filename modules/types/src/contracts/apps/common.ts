import { enumify } from "../../utils";

export const FastSignedTransfer = "FastSignedTransfer";
export const LinkedTransfer = "LinkedTransfer";
export const LinkedTransferToRecipient = "LinkedTransferToRecipient";

export const ConditionalTransferTypes = enumify({
  [FastSignedTransfer]: FastSignedTransfer,
  [LinkedTransfer]: LinkedTransfer,
  [LinkedTransferToRecipient]: LinkedTransferToRecipient,
});

export type ConditionalTransferTypes =
  (typeof ConditionalTransferTypes)[keyof typeof ConditionalTransferTypes];
