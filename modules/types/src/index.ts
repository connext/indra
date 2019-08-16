import { BigNumber as ethersBig } from "ethers/utils";

////////////////////////////////////
////// BASIC TYPINGS
export type BigNumber = ethersBig;
export const BigNumber = ethersBig;

export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

export * from "./app";
export * from "./convert";
export * from "./inputs";
export * from "./node";
