import { hexDataLength, hexlify, isHexString, randomBytes } from "ethers/utils";

export const getHexStringError = (value: any): string | undefined => {
  if (typeof value !== "string" || !isHexString(value)) {
    return `Value "${value.toString()}" is not a valid hex string`;
  }
  return undefined;
};
export const invalidHexString = getHexStringError;
export const isValidHexString = (value: any): boolean => !getHexStringError(value);

export const getBytes32Error = (value: any): string | undefined => {
  const hexStringError = getHexStringError(value);
  if (hexStringError) {
    return hexStringError;
  }
  // check that its 32 bytes
  if (hexDataLength(value) !== 32) {
    return `Value "${value.toString()}" is not a valid 32 byte hex string`;
  }
  return undefined;
};
export const invalidBytes32 = getBytes32Error;
export const isValidBytes32 = (value: any): boolean => !getBytes32Error(value);

export const getEthSignatureError = (value: any): string | undefined => {
  const hexStringError = getHexStringError(value);
  if (hexStringError) {
    return hexStringError;
  }
  // check that its 32 bytes
  if (hexDataLength(value) !== 65) {
    return `Value "${value.toString()}" is not a valid 65 byte hex string`;
  }
  return undefined;
};
export const invalidEthSignature = getEthSignatureError;
export const isValidEthSignature = (value: any): boolean => !getEthSignatureError(value);

export const isValidKeccak256Hash = isValidBytes32;
export const invalidKeccak256Hash = invalidBytes32;

////////////////////////////////////////
// Misc

export const removeHexPrefix = (hex: string): string => {
  return hex.replace(/^0x/, "");
};

export const addHexPrefix = (hex: string): string => {
  return hex.startsWith("0x") ? hex : `0x${hex}`;
};

export const createRandomBytes32 = () => {
  return hexlify(randomBytes(32));
};
