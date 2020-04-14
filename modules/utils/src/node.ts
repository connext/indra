import { arrayify, isHexString, getAddress } from "ethers/utils";

export const isValidHex = (hex: string, bytes?: number): boolean =>
  isHexString(hex) && (bytes ? arrayify(hex).length === bytes : true);

export const isEthAddress = (address: string): boolean => isValidHex(address, 20);

export const isKeccak256Hash = (address: string): boolean => isValidHex(address, 32);

export const isEthSignature = (signature: string): boolean => isValidHex(signature, 65);

export const isBytes32 = (address: string): boolean => isValidHex(address, 32);

export const isAddress = (address: string): boolean => /^address[a-zA-Z0-9]{107}$/.test(address);

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

export const safeJsonParseReborn = (value: any): any => {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};
