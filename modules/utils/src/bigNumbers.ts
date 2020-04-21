import { HexObject } from "@connext/types";
import { BigNumber, BigNumberish, bigNumberify } from "ethers/utils";

export const isBN = BigNumber.isBigNumber;

export const toBN = (n: BigNumberish | HexObject): BigNumber =>
  bigNumberify((n && (n as HexObject)._hex) ? (n as HexObject)._hex : n.toString());

export const getBigNumberError = (value: any): string | undefined =>
  isBN(value) ? undefined : `Value "${value}" is not a BigNumber`;

export const getBigNumberishError = (value: any): string | undefined => {
  try {
    toBN(value);
  } catch (e) {
    return `Value "${value}" is not BigNumberish: ${e.message}`;
  }
  return undefined;
};
