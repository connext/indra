import { utils } from "ethers";

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

  return undefined;
}

export function invalidAddress(value: string): string | undefined {
  if (!isValidAddress(value)) {
    return `Value provided is not a valid eth address. Value: ${value}`;
  }

  return undefined;
}
