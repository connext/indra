import { utils } from "ethers";

import { AsyncStorageWrapper, LocalStorageWrapper } from "../wrappers";

import { ASYNC_STORAGE_TEST_KEY } from "./constants";
import { IAsyncStorage, ChannelsMap, StorageWrapper } from "./types";

export function arrayify(value: string | ArrayLike<number> | utils.Hexable): Uint8Array {
  return utils.arrayify(value);
}

export function hexlify(value: string | number | ArrayLike<number> | utils.Hexable): string {
  return utils.hexlify(value);
}

export function keccak256(data: utils.Arrayish): string {
  return utils.keccak256(data);
}

export function toUtf8Bytes(str: string, form?: utils.UnicodeNormalizationForm | undefined): Uint8Array {
  return utils.toUtf8Bytes(str, form);
}

export function toUtf8String(bytes: utils.Arrayish, ignoreErrors?: boolean | undefined): string {
  return utils.toUtf8String(bytes, ignoreErrors);
}

export function safeJsonParse(value: any): any {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function safeJsonStringify(value: any): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

export function removeAsyncStorageTest(storage: Storage | IAsyncStorage, promiseTest: Promise<void>): void {
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

export function wrapAsyncStorage(asyncStorage: IAsyncStorage, asyncStorageKey?: string): StorageWrapper {
  const storage: StorageWrapper = new AsyncStorageWrapper(asyncStorage, asyncStorageKey);
  return storage;
}

export function wrapLocalStorage(localStorage: Storage): StorageWrapper {
  const storage: StorageWrapper = new LocalStorageWrapper(localStorage);
  return storage;
}

export function wrapStorage(storage: any, asyncStorageKey?: string): StorageWrapper {
  return isAsyncStorage(storage) ? wrapAsyncStorage(storage, asyncStorageKey) : wrapLocalStorage(storage);
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
