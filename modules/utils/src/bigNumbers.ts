import * as ethers from "ethers";
import { HexObject } from "@connext/types";

export const isBN = ethers.BigNumber.isBigNumber;

export const toBN = (n: ethers.BigNumberish | HexObject): ethers.BigNumber =>
  ethers.BigNumber.from(n && (n as HexObject)._hex ? (n as HexObject)._hex : n.toString());

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
