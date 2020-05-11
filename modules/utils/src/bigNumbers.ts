import { BigNumberJson } from "@connext/types";
import { BigNumber, BigNumberish } from "ethers";

export const isBN = BigNumber.isBigNumber;

export function toBN(n: BigNumberish | BigNumberJson): BigNumber {
  return BigNumber.from(n && (n as BigNumberJson)._hex ? (n as BigNumberJson)._hex : n.toString());
}

export function toBNJson(n: BigNumberish | BigNumberJson): BigNumberJson {
  return {
    _hex: toBN(n).toHexString(),
  };
}

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
