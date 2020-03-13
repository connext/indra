import {
  ConnextStore,
  KeyValueStorage,
  WrappedLocalStorage,
  FileStorage,
  WrappedAsyncStorage,
} from "@connext/store";
import {
  StoreFactoryOptions,
  StorePair,
  StoreType,
  StoreTypes,
  ASYNCSTORAGE,
  WrappedStorage,
  LOCALSTORAGE,
  FILESTORAGE,
} from "@connext/types";
import { BigNumber } from "ethers/utils";
import MockAsyncStorage from "mock-async-storage";
import uuid from "uuid";

import { expect } from "../";

export const TEST_STORE_PAIR: StorePair = { path: "testing", value: "something" };

export function createKeyValueStore(type: StoreType, opts: StoreFactoryOptions = {}) {
  switch (type) {
    case ASYNCSTORAGE:
      return new KeyValueStorage(
        new WrappedAsyncStorage(
          new MockAsyncStorage(),
          opts.prefix,
          opts.separator,
          opts.asyncStorageKey,
        ),
      );
    case LOCALSTORAGE:
      return new KeyValueStorage(new WrappedLocalStorage(opts.prefix, opts.separator));
    case FILESTORAGE:
      return new KeyValueStorage(
        new FileStorage(opts.prefix, opts.separator, opts.fileExt, opts.fileDir),
      );
    default:
      throw new Error(`Unable to create KeyValueStore from type: ${type}`);
  }
}

export function createConnextStore(type: StoreType, opts: StoreFactoryOptions = {}): ConnextStore {
  if (!Object.values(StoreTypes).includes(type)) {
    throw new Error(`Unrecognized type: ${type}`);
  }

  if (type === ASYNCSTORAGE) {
    opts.storage = new MockAsyncStorage();
  }

  const store = new ConnextStore(type, opts);
  expect(store).to.be.instanceOf(ConnextStore);

  return store;
}

export function createArray(length: number = 10): string[] {
  return Array(length).fill("");
}

export function generateStorePairs(length: number = 10): StorePair[] {
  return createArray(length).map(() => {
    const id = uuid.v1();
    return { path: `path-${id}`, value: `value-${id}` };
  });
}

export async function setAndGet(
  store: KeyValueStorage,
  pair: StorePair = TEST_STORE_PAIR,
): Promise<void> {
  await store.setItem(pair.path, pair.value);
  const value = await store.getItem(pair.path);
  if (typeof pair.value === "object" && !BigNumber.isBigNumber(pair.value)) {
    expect(value).to.be.deep.equal(pair.value);
    return;
  }
  expect(value).to.be.equal(pair.value);
}

export async function setAndGetMultiple(
  store: KeyValueStorage,
  length: number = 10,
): Promise<void> {
  const pairs = generateStorePairs(length);
  expect(pairs.length).to.equal(length);
  for (const pair of pairs) {
    await setAndGet(store, pair);
  }
}

export async function testAsyncStorageKey(
  storage: WrappedStorage,
  asyncStorageKey: string,
): Promise<void> {
  const keys = await storage.getKeys();
  expect(keys.length).to.equal(1);
  expect(keys[0]).to.equal(asyncStorageKey);
}
