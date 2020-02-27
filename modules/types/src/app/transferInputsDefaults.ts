////// Transfer types
import { Address } from "../basic";
import { ProtocolTypes } from "../protocol";
export const LINKED_TRANSFER = "LINKED_TRANSFER";
export const LINKED_TRANSFER_TO_RECIPIENT = "LINKED_TRANSFER_TO_RECIPIENT";
export const SIGNATURE_TRANSFER = "SIGNATURE_TRANSFER";

export const TransferConditions = {
  [LINKED_TRANSFER]: LINKED_TRANSFER,
  [LINKED_TRANSFER_TO_RECIPIENT]: LINKED_TRANSFER_TO_RECIPIENT,
};

export type TransferCondition = keyof typeof TransferConditions;

export type TransferParameters<T = string> = {
  amount: T;
  assetId?: Address;
  paymentId: string;
  meta?: object;
};

export type TransferResponse = {
  paymentId: string;
  freeBalance: ProtocolTypes.GetFreeBalanceStateResult;
  meta?: object;
};

export type ResolveTransferParameters<T = string> = Omit<
  TransferParameters<T>,
  "amount" | "assetId" | "meta"
>;

export type ResolveTransferResponse = {
  appId: string;
  freeBalance: ProtocolTypes.GetFreeBalanceStateResult;
  paymentId: string;
  meta?: object;
};
