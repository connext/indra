import { arrayify, getAddress, isHexString } from "ethers/utils";
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

export const invalidIdentifier = (identifier: string): string | undefined => {
  let parsed;
  let errors: string[] = [];
  try {
    parsed = parsePublicIdentifier(identifier);
  } catch (e) {
    errors.push(`Identifier is invalid: ${identifier}`);
    return errors.toString();
  }
  if (!parsed.chainId || typeof parsed.chainId !== "number") {
    errors.push(`Identifier has invalid chainId: ${identifier}`);
  }
  if (!parsed.namespace || typeof parsed.namespace !== "string") {
    errors.push(`Identifier has invalid namespace: ${identifier}`);
  }
  if (!parsed.address || invalidAddress(parsed.address)) {
    errors.push(`Identifier has invalid address: ${identifier}`);
  }
  return errors.length === 0 ? undefined : errors.toString();
};

