import { arrayify, computeAddress, getAddress, isHexString } from "ethers/utils";
import { parsePublicIdentifier } from "@connext/types";

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
  let parsed;
  let address;
  let errors: string[] = [];
  try {
    parsed = parsePublicIdentifier(identifier);
    address = computeAddress(parsed.publicKey);
  } catch (e) {
    errors.push(`PublicIdentifier is invalid: ${identifier}`);
    return errors.toString();
  }
  if (!parsed.chainId || typeof parsed.chainId !== "number") {
    errors.push(`PublicIdentifier has invalid chainId: ${identifier}`);
  }
  if (!parsed.namespace || typeof parsed.namespace !== "string") {
    errors.push(`PublicIdentifier has invalid namespace: ${identifier}`);
  }
  if (!parsed.publicKey || !isHexString(parsed.publicKey)) {
    errors.push(`PublicIdentifier has invalid publicKey: ${identifier}`);
  }
  if (!address || invalidAddress(address)) {
    errors.push(`PublicIdentifier has invalid address: ${identifier}`);
  }
  return errors.length === 0 ? undefined : errors.toString();
};
