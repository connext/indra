import { arrayify, isHexString } from "ethers/utils";
import { getSignerAddressFromPublicIdentifier } from "@connext/crypto";
export { invalidAddress } from "@connext/types";

export const isValidAddress = (address: any): boolean =>
  typeof address === "string" && isHexString(address) && arrayify(address).length === 20;

export const isValidPublicIdentifier = (id: string): boolean => {
  try {
    const addr = getSignerAddressFromPublicIdentifier(id);
    return isValidAddress(addr);
  } catch (e) {
    return false;
  }
};

export const invalidPublicIdentifier = (identifier: string): string | undefined => {
  const valid = isValidPublicIdentifier(identifier);
  return valid ? undefined : `Invalid public key identifier: ${identifier}`;
};
