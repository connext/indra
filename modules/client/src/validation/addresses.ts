import { arrayify, getAddress, isHexString } from "ethers/utils";

export const isValidAddress = (address: any): boolean =>
  typeof address === "string" && isHexString(address) && arrayify(address).length === 20;

export const invalidXpub = (value: string): string | undefined => {
  if (!value || !value.startsWith("xpub")) {
    return `Value "${value}" must start with "xpub"`;
  }
  return undefined;
};

export const invalidAddress = (value: string): string | undefined => {
  try {
    getAddress(value);
    return undefined;
  } catch (e) {
    return e.message;
  }
};
