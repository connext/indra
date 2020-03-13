import { toBN } from "./math";

export const decFromBN = (key: string, value: any): any =>
  value && value._hex ? toBN(value).toString() : value;

export const hexFromBN = (key: string, value: any): any =>
  value && value._hex ? toBN(value).toHexString() : value;

export const stringify = (obj: any, space: number = 0): string =>
  JSON.stringify(obj, decFromBN, space);

export const delay = (ms: number): Promise<void> =>
  new Promise((res: any): any => setTimeout(res, ms));
