import { hexDataLength, hexlify, isHexString, getAddress, randomBytes } from "ethers/utils";

export const getHexStringError = (value: any, length?: number): string | undefined => {
  if (typeof value !== "string" || !isHexString(value)) {
    return `Value "${value.toString()}" is not a valid hex string`;
  }
  if (length && hexDataLength(value) !== length) {
    return `Value "${value.toString()}" is not ${length} bytes long`;
  }
  return undefined;
};
export const isValidHexString = (value: any): boolean => !getHexStringError(value);

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
export const isValidAddress = (value: any): boolean => !getAddressError(value);

export const getBytes32Error = (value: any): string | undefined => {
  const hexStringError = getHexStringError(value, 32);
  if (hexStringError) return hexStringError;
  return undefined;
};
export const isValidBytes32 = (value: any): boolean => !getBytes32Error(value);

export const isValidKeccak256Hash = isValidBytes32;

////////////////////////////////////////
// Generators

export const getRandomAddress = () => hexlify(randomBytes(20));
export const getRandomBytes32 = () => hexlify(randomBytes(32));

export const addHexPrefix = (hex: string): string => hex.startsWith("0x") ? hex : `0x${hex}`;
export const removeHexPrefix = (hex: string): string => hex.replace(/^0x/, "");
