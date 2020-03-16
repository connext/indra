import { toBN } from "./math";

// stolen from https://github.com/microsoft/TypeScript/issues/3192#issuecomment-261720275
export const enumify = <T extends {[index: string]: U}, U extends string>(x: T): T => x;

export const decFromBN = (key: string, value: any): any =>
  value && value._hex ? toBN(value).toString() : value;

export const hexFromBN = (key: string, value: any): any =>
  value && value._hex ? toBN(value).toHexString() : value;

export const stringify = (obj: any, space: number = 0): string =>
  JSON.stringify(obj, decFromBN, space);

export const delay = (ms: number): Promise<void> =>
  new Promise((res: any): any => setTimeout(res, ms));
