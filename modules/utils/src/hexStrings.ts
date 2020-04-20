import { hexDataLength, hexlify, isHexString, randomBytes } from "ethers/utils";

export const getHexStringError = (value: any, length?: number): string | undefined => {
  if (typeof value !== "string" || !isHexString(value)) {
    return `Value "${value.toString()}" is not a valid hex string`;
  }
  if (length && hexDataLength(value) !== length) {
    return `Value "${value.toString()}" is not ${length} bytes long`;
  }
  return undefined;
};
export const invalidHexString = getHexStringError;
export const isValidHexString = (value: any): boolean => !getHexStringError(value);

export const getBytes32Error = (value: any): string | undefined => {
  const hexStringError = getHexStringError(value, 32);
  if (hexStringError) return hexStringError;
  return undefined;
};
export const invalidBytes32 = getBytes32Error;
export const isValidBytes32 = (value: any): boolean => !getBytes32Error(value);

export const isValidKeccak256Hash = isValidBytes32;
export const invalidKeccak256Hash = invalidBytes32;

// Misc
export const addHexPrefix = (hex: string): string => hex.startsWith("0x") ? hex : `0x${hex}`;
export const getRandomBytes32 = () => hexlify(randomBytes(32));
export const removeHexPrefix = (hex: string): string => hex.replace(/^0x/, "");
