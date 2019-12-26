import { bigNumberify, getAddress, HDNode } from "ethers/utils";

import { isEthAddress } from "./validate";

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

export const normalizeEthAddresses = (obj: any): any => {
  const res = {};
  Object.entries(obj).forEach(([key, value]: any): any => {
    if (isEthAddress(value as string)) {
      res[key] = getAddress(value as any);
      return;
    }
    res[key] = value;
    return;
  });
  return res;
};

export function mkXpub(prefix: string = "xpub"): string {
  return prefix.padEnd(111, "0");
}

export function mkAddress(prefix: string = "0x"): string {
  return prefix.padEnd(42, "0");
}

export function mkHash(prefix: string = "0x"): string {
  return prefix.padEnd(66, "0");
}

export function mkSig(prefix: string = "0x"): string {
  return prefix.padEnd(132, "0");
}
