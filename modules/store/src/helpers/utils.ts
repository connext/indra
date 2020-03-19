import { utils } from "ethers";

import { ASYNC_STORAGE_TEST_KEY } from "./constants";
import { IAsyncStorage, ChannelsMap } from "./types";

export function arrayify(value: string | ArrayLike<number> | utils.Hexable): Uint8Array {
  return utils.arrayify(value);
}

export function hexlify(value: string | number | ArrayLike<number> | utils.Hexable): string {
  return utils.hexlify(value);
}

export function keccak256(data: utils.Arrayish): string {
  return utils.keccak256(data);
}

export function toUtf8Bytes(
  str: string,
  form?: utils.UnicodeNormalizationForm | undefined,
): Uint8Array {
  return utils.toUtf8Bytes(str, form);
}

export function toUtf8String(bytes: utils.Arrayish, ignoreErrors?: boolean | undefined): string {
  return utils.toUtf8String(bytes, ignoreErrors);
}

export function safeJsonParse(value: any): any {
  try {
    // assert null --> undefined conversion
    return convertObjectValuesRecursive(JSON.parse(value), null, undefined);
  } catch {
    return value;
  }
}

function convertObjectValuesRecursive(obj: object, target: any, replacement: any): any {
  const ret = { ...obj };
  Object.keys(ret).forEach(key => {
    if (ret[key] === target) {
      ret[key] = replacement;
    } else if (typeof ret[key] === "object" && !Array.isArray(ret[key])) {
      ret[key] = convertObjectValuesRecursive(ret[key], target, replacement);
    }
  });
  return ret;
}

export function safeJsonStringify(value: any): string {
  // make sure undefined are converted to null
  return typeof value === "string"
    ? value
    : JSON.stringify(value, (key: string, value: any) =>
        typeof value === "undefined" ? null : value,
      );
}

export function removeAsyncStorageTest(
  storage: Storage | IAsyncStorage,
  promiseTest: Promise<void>,
): void {
  if (promiseTest && promiseTest.then) {
    promiseTest.then(() => {
      storage.removeItem(ASYNC_STORAGE_TEST_KEY);
    });
    return;
  }
  storage.removeItem(ASYNC_STORAGE_TEST_KEY);
}

export function isAsyncStorage(storage: Storage | IAsyncStorage): boolean {
  const promiseTest = storage.setItem(ASYNC_STORAGE_TEST_KEY, "test");
  const result = !!(
    typeof promiseTest !== "undefined" &&
    typeof promiseTest.then !== "undefined" &&
    typeof (storage as Storage).length === "undefined"
  );
  removeAsyncStorageTest(storage, promiseTest);
  return result;
}

export function reduceChannelsMap(entries: [string, any][]): ChannelsMap {
  return entries.reduce((channels, [path, value]) => {
    const _value = safeJsonParse(value);
    if (path.includes("channel")) {
      channels[_value.multisigAddress] = _value;
    }
    return channels;
  }, {});
}
