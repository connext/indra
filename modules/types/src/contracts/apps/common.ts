import { BigNumber } from "../../basic";
import { enumify } from "../../utils";

export const FastSignedTransfer = "FastSignedTransfer";
export const HashLockTransfer = "HashLockTransfer";
export const LinkedTransfer = "LinkedTransfer";

export const ConditionalTransferTypes = enumify({
  [FastSignedTransfer]: FastSignedTransfer,
  [HashLockTransfer]: HashLockTransfer,
  [LinkedTransfer]: LinkedTransfer,
});

export type ConditionalTransferTypes =
  (typeof ConditionalTransferTypes)[keyof typeof ConditionalTransferTypes];

export type TransferAction = {
  finalize: boolean;
  transferAmount: BigNumber;
};
