import { utils } from "ethers";

import { publicIdentifierToAddress } from "../lib/utils";

// contains all of the address-based verification functions
function isValidAddress(value: any): boolean {
  if (typeof value !== "string") {
    return false;
  }
  try {
    utils.getAddress(value);
  } catch (e) {
    return false;
  }
  return true;
}

export function invalidXpub(value: string): string | undefined {
  if (!value.startsWith("xpub")) {
    return `Value must start with "xpub". Value: ${value}`;
  }

  let addr;
  try {
    addr = publicIdentifierToAddress(value);
  } catch (e) {
    return `Could not public identifier to address. Value: ${value}`;
  }

  if (!isValidAddress(addr)) {
    return (
      `Invalid address derived from provided public identifier.` +
      `Value: ${value}, derivce address: ${addr}`
    );
  }

  return undefined;
}

export function invalidAddress(value: string): string | undefined {
  if (!isValidAddress(value)) {
    return `Value provided is not a valid eth address. Value: ${value}`;
  }

  return undefined;
}
