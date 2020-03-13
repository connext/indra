import { bigNumberify } from "ethers/utils";

export const replaceBN = (key: string, value: any): any =>
  value && value._hex ? bigNumberify(value).toString() : value;

export const stringify = (obj: any, space: number = 0): string =>
  JSON.stringify(obj, replaceBN, space);

export const delay = (ms: number): Promise<void> =>
  new Promise((res: any): any => setTimeout(res, ms));
