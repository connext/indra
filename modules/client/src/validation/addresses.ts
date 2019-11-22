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
  if (!value || !value.startsWith("xpub")) {
    return `Value "${value}" must start with "xpub"`;
  }

  return undefined;
}

export function invalidAddress(value: string): string | undefined {
  if (!value || !isValidAddress(value)) {
    return `Value "${value}" is not a valid eth address`;
  }

  return undefined;
}
