import { utils } from "ethers";
import { hexDataLength } from "ethers/utils";

export function invalid32ByteHexString(value: any): string | undefined {
  if (typeof value !== "string" || !utils.isHexString(value)) {
    return `Value "${value.toString()}" is not a valid hex string`;
  }
  // check that its 32 bytes
  if (hexDataLength(value) !== 32) {
    return `Value "${value.toString()}" is not a valid 32 byte hex string`;
  }

  return undefined;
}
