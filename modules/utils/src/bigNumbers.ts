import { BigNumberJson } from "@connext/types";
import { BigNumber, BigNumberish, bigNumberify } from "ethers/utils";

export const isBN = BigNumber.isBigNumber;

export const isBNJson = (value: any): boolean => !isBN(value) && !!value._hex;

export const toBN = (n: BigNumberish | BigNumberJson): BigNumber =>
  bigNumberify(n && (n as BigNumberJson)._hex ? (n as BigNumberJson)._hex : n.toString());

export const toBNJson = (n: BigNumberish | BigNumberJson): BigNumberJson => ({
  _hex: toBN(n).toHexString(),
});

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
