import { BigNumberJson } from "@connext/types";
import { BigNumber, BigNumberish } from "ethers";

export const isBigNumber = (value: any): boolean =>
  !!BigNumber.isBigNumber(value) && !!value.toHexString;

export const isBigNumberJson = (value: any): boolean => !isBigNumber(value) && !!value._hex;

export function toBigNumberJson(n: BigNumberish | BigNumberJson): BigNumberJson {
  return JSON.parse(JSON.stringify(n));
}

export const getBigNumberError = (value: any): string | undefined =>
  isBigNumber(value) ? undefined : `Value "${value}" is not a BigNumber`;

export const getBigNumberishError = (value: any): string | undefined => {
  try {
    BigNumber.from(value);
  } catch (e) {
    return `Value "${value}" is not BigNumberish: ${e.message}`;
  }
  return undefined;
};
