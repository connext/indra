import { BigNumber as ethersBig } from "ethers/utils";
import { CFCoreTypes } from "./cf";

export type BigNumber = ethersBig;
export const BigNumber = ethersBig;

export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

export const ConnextEvents = {
  ...CFCoreTypes.EventNames,
  RECIEVE_TRANSFER_FAILED_EVENT: "RECIEVE_TRANSFER_FAILED_EVENT",
  RECIEVE_TRANSFER_FINISHED_EVENT: "RECIEVE_TRANSFER_FINISHED_EVENT",
  RECIEVE_TRANSFER_STARTED_EVENT: "RECIEVE_TRANSFER_STARTED_EVENT",
};
export type ConnextEvent = keyof typeof ConnextEvents;

export const ConnextNodeStorePrefix = "INDRA_NODE_CF_CORE";

export const ConnextClientStorePrefix = "INDRA_CLIENT_CF_CORE";
