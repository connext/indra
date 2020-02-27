import { Address, CoinTransfer } from "@connext/types";

export const FAST_SIGNED_TRANSFER = "FAST_SIGNED_TRANSFER";

export const FastSignedTransferApp = "FastSignedTransferApp";

export type FastSignedTransferParameters<T = string> = {
  conditionType: typeof FAST_SIGNED_TRANSFER;
  recipient: string;
  amount: T;
  assetId?: Address;
  paymentId: string;
  maxAllocation?: T;
  signer: Address;
  meta?: object;
};

export enum FastSignedTransferActionType {
  CREATE,
  UNLOCK,
  REJECT,
  FINALIZE,
}

export type FastSignedTransfer<T = string> = {
  amount: T;
  assetId: Address;
  signer: Address;
  paymentId: string;
  timeout: T;
  receipientXpub: string;
  data: string;
  signature: string;
};

export type FastSignedTransferAppState<T = string> = {
  lockedPayments: FastSignedTransfer<T>[];
  coinTransfers: [CoinTransfer<T>, CoinTransfer<T>];
  finalized: boolean;
  turnNum: T;
};

export type FastSignedTransferAppAction<T = string> = {
  newLockedPayments: FastSignedTransfer<T>[];
  actionType: FastSignedTransferActionType;
};
