import { bigNumberify, getAddress } from "ethers/utils";

import { isEthAddress } from "../validator";

export const replaceBN = (key: string, value: any): any =>
  value && value._hex ? value.toString() : value;

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
