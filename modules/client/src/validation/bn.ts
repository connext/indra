import { utils } from "ethers";

// this contains all of the bn related validation
// all functions in this library will return `undefined` if the conditions are
// met, or a descriptive string if they are not

export const falsy = (x: string | undefined): boolean => !!x;

export function notBigNumber(value: any): string | undefined {
  return utils.BigNumber.isBigNumber(value)
    ? undefined
    : `Value is not a bignumber. Value: ${JSON.stringify(value, null, 2)}`;
}

export function notBigNumberish(value: any): string | undefined {
  try {
    utils.bigNumberify(value);
  } catch (e) {
    return `Value is not bignumberish. Value: ${JSON.stringify(value, null, 2)}`;
  }
  return undefined;
}

export function notGreaterThan(value: any, floor: utils.BigNumberish): string | undefined {
  if (notBigNumberish(value)) {
    return notBigNumberish(value);
  }
  return utils.bigNumberify(value).gt(floor)
    ? undefined
    : `Value (${value.toString()}) is not greater than ${floor.toString()}`;
}

export function notGreaterThanOrEqualTo(value: any, floor: utils.BigNumberish): string | undefined {
  if (notBigNumberish(value)) {
    return notBigNumberish(value);
  }
  return utils.bigNumberify(value).gte(floor)
    ? undefined
    : `Value (${value.toString()}) is not greater than or equal to ${floor.toString()}`;
}

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
  return notLessThanOrEqualTo(value, 0);
}

export function notNegative(value: any): string | undefined {
  return notGreaterThan(value, 0);
}
