import { isBN, toBN } from "./math";

// stolen from https://github.com/microsoft/TypeScript/issues/3192#issuecomment-261720275
export const enumify = <T extends {[index: string]: U}, U extends string>(x: T): T => x;

export const bigNumberifyJson = (json: any): object =>
  typeof json === "string" ? json : JSON.parse(
    JSON.stringify(json),
    (key: string, value: any): any => (value && value["_hex"]) ? toBN(value._hex) : value,
  );

export const deBigNumberifyJson = (json: object) =>
  JSON.parse(
    JSON.stringify(json),
    (key: string, val: any) => (val && isBN(val)) ? val.toHexString() : val,
  );

export const stringify = (obj: any, space: number = 2): string =>
  JSON.stringify(
    obj,
    (key: string, value: any): any => (value && value._hex) ? toBN(value._hex).toString() : value,
    space,
  );

export const delay = (ms: number): Promise<void> =>
  new Promise((res: any): any => setTimeout(res, ms));
