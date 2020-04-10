import { arrayify, getAddress, isHexString } from "ethers/utils";
import { isValidPublicIdentifier } from "@connext/types";

export const isValidAddress = (address: any): boolean =>
  typeof address === "string" && isHexString(address) && arrayify(address).length === 20;

export const invalidAddress = (value: string): string | undefined => {
  try {
    getAddress(value);
    return undefined;
  } catch (e) {
    return e.message;
  }
};

export const invalidPublicIdentifier = (identifier: string): string | undefined => {
  const valid = isValidPublicIdentifier(identifier);
  return valid ? undefined : `Invalid public key identifier: ${identifier}`;
};
