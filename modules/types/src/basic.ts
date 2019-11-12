import { BigNumber as ethersBig } from "ethers/utils";

export type BigNumber = ethersBig;
export const BigNumber = ethersBig;

export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

export const ConnextEvents = {
  RECIEVE_TRANSFER_FAILED: "receiveTransferFailedEvent",
  RECIEVE_TRANSFER_FINISHED: "receiveTransferFinishedEvent",
  RECIEVE_TRANSFER_STARTED: "receiveTransferStartedEvent",
};
export type ConnextEvent = keyof typeof ConnextEvents;

export const ConnextNodeStorePrefix = "INDRA_NODE_CF_CORE";

export const ConnextClientStorePrefix = "INDRA_CLIENT_CF_CORE";
