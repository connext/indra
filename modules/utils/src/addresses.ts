import { getAddress, hexlify, randomBytes } from "ethers/utils";

export const getAddressError = (value: string): string | undefined => {
  try {
    getAddress(value);
    return undefined;
  } catch (e) {
    return e.message;
  }
};
export const invalidAddress = getAddressError;
export const isValidAddress = (value: string): boolean => !invalidAddress(value);

export const createRandomAddress = () => {
  return hexlify(randomBytes(20));
};

export const normalizeEthAddresses = (obj: any): any => {
  const res = {};
  Object.entries(obj).forEach(([key, value]: any): any => {
    if (isValidAddress(value as string)) {
      res[key] = getAddress(value as any);
      return;
    }
    res[key] = value;
    return;
  });
  return res;
};
