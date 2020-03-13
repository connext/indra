import { bigNumberify } from "ethers/utils";

export const stringify = (obj: any, space: number = 0): string =>
  JSON.stringify(obj, replaceBN, space);

export const replaceBN = (key: string, value: any): any =>
  value && value._hex ? bigNumberify(value).toString() : value;

export const delay = (ms: number): Promise<void> =>
  new Promise((res: any): any => setTimeout(res, ms));

export const bigNumberifyObj = (obj: any): any => {
  const res = {};
  Object.entries(obj).forEach(([key, value]: any): any => {
    if (value["_hex"]) {
      res[key] = bigNumberify(value as any);
      return;
    }
    res[key] = value;
    return;
  });
  return res;
};
