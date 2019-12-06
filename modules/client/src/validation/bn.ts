import { utils } from "ethers";

import { stringify } from "../lib";

// this contains all of the bn related validation
// all functions in this library will return `undefined` if the conditions are
// met, or a descriptive string if they are not
// naming is designed to:
// if (notLessThanOrEqualTo) {
//   throw new Error(notLessThanOrEqualTo)
// }

export const falsy = (x: string | undefined): boolean => !!x;

export function notBigNumber(value: any): string | undefined {
  return utils.BigNumber.isBigNumber(value)
    ? undefined
    : `Value "${stringify(value)}" is not a bignumber`;
}

export function notBigNumberish(value: any): string | undefined {
  try {
    utils.bigNumberify(value);
  } catch (e) {
    return `Value ${stringify(value)} is not bignumberish}`;
  }
  return undefined;
}

// return string when value is not greater than ceiling
export function notGreaterThan(value: any, ceil: utils.BigNumberish): string | undefined {
  if (notBigNumberish(value)) {
    return notBigNumberish(value);
  }
  return utils.bigNumberify(value).gt(utils.bigNumberify(ceil))
    ? undefined
    : `Value (${value.toString()}) is not greater than ${ceil.toString()}`;
}

export function notGreaterThanOrEqualTo(value: any, ceil: utils.BigNumberish): string | undefined {
  if (notBigNumberish(value)) {
    return notBigNumberish(value);
  }
  return utils.bigNumberify(value).gte(ceil)
    ? undefined
    : `Value (${value.toString()}) is not greater than or equal to ${ceil.toString()}`;
}

// return string when value is not less than floor
export function notLessThan(value: any, floor: utils.BigNumberish): string | undefined {
  if (notBigNumberish(value)) {
    return notBigNumberish(value);
  }
  return utils.bigNumberify(value).lt(floor)
    ? undefined
    : `Value (${value.toString()}) is not less than ${floor.toString()}`;
}

export function notLessThanOrEqualTo(value: any, floor: utils.BigNumberish): string | undefined {
  if (notBigNumberish(value)) {
    return notBigNumberish(value);
  }
  return utils.bigNumberify(value).lte(floor)
    ? undefined
    : `Value (${value.toString()}) is not less than or equal to ${floor.toString()}`;
}

export function notPositive(value: any): string | undefined {
  return notGreaterThanOrEqualTo(value, 0);
}

export function notNegative(value: any): string | undefined {
  return notLessThan(0, value);
}
