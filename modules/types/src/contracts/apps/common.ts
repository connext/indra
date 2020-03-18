import { enumify } from "../../utils";

export const FastSignedTransfer = "FastSignedTransfer";
export const HashLockTransfer = "HashLockTransfer";
export const LinkedTransfer = "LinkedTransfer";
export const LinkedTransferToRecipient = "LinkedTransferToRecipient";

export const ConditionalTransferTypes = enumify({
  [FastSignedTransfer]: FastSignedTransfer,
  [HashLockTransfer]: HashLockTransfer,
  [LinkedTransfer]: LinkedTransfer,
  [LinkedTransferToRecipient]: LinkedTransferToRecipient,
});

export type ConditionalTransferTypes =
  (typeof ConditionalTransferTypes)[keyof typeof ConditionalTransferTypes];
