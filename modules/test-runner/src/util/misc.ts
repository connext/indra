import { expect } from ".";
import { TestMessagingService } from "./messaging";
import { hexlify, randomBytes } from "ethers/utils";

export const delay = async (ms: number) =>
  new Promise((res: Function): number => setTimeout(res, ms));

export const combineObjects = (overrides: any, defaults: any): any => {
  if (!overrides && defaults) {
    return { ...defaults };
  }
  const ret = { ...defaults };
  Object.entries(defaults).forEach(([key, value]) => {
    // if there is non override, return without updating defaults
    if (!overrides[key]) {
      // no comparable value, return
      return;
    }

    if (overrides[key] && typeof overrides[key] === "object") {
      ret[key] = { ...(value as any), ...overrides[key] };
      return;
    }

    if (overrides[key] && typeof overrides[key] !== "object") {
      ret[key] = overrides[key];
    }

    // otherwise leave as default
    return;
  });
  return ret;
};

export function createRandomBytesHexString(length: number) {
  return hexlify(randomBytes(length));
}

export function createRandomAddress() {
  return createRandomBytesHexString(20);
}

export function createRandom32ByteHexString() {
  return createRandomBytesHexString(32);
}
