import { getAddress, hexlify, randomBytes } from "ethers/utils";

import { getHexStringError } from "./hexStrings";

export const getAddressError = (value: any): string | undefined => {
  try {
    const hexError = getHexStringError(value, 20);
    if (hexError) return hexError;
    getAddress(value);
    return undefined;
  } catch (e) {
    return e.message;
  }
};
export const invalidAddress = getAddressError;
export const isValidAddress = (value: any): boolean => !invalidAddress(value);

export const getRandomAddress = () => hexlify(randomBytes(20));

export const normalizeEthAddresses = (obj: any): any => {
  const res = {};
  Object.entries(obj).forEach(([key, value]: any): any => {
    if (isValidAddress(value)) {
      res[key] = getAddress(value);
      return;
    }
    res[key] = value;
    return;
  });
  return res;
};
