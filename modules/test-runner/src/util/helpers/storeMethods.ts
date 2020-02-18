import { ConnextStore, FileStorage, MemoryStorage } from "@connext/store";
import { IAsyncStorage, StoreFactoryOptions, StorePair } from "@connext/types";
import { BigNumber } from "ethers/utils";
import localStorage from "localStorage";
import MockAsyncStorage from "mock-async-storage";
import uuid from "uuid";

import { expect } from "../";

export const TEST_STORE_PAIR: StorePair = { path: "testing", value: "something" };

export const ASYNCSTORAGE = "ASYNCSTORAGE";
export const FILESTORAGE = "FILESTORAGE";
export const LOCALSTORAGE = "LOCALSTORAGE";
export const MEMORYSTORAGE = "MEMORYSTORAGE";

const StoreTypes = {
  [ASYNCSTORAGE]: ASYNCSTORAGE,
  [FILESTORAGE]: FILESTORAGE,
  [LOCALSTORAGE]: LOCALSTORAGE,
  [MEMORYSTORAGE]: MEMORYSTORAGE,
};
type StoreType = keyof typeof StoreTypes;

export function createStore(
  type: StoreType,
  opts?: StoreFactoryOptions,
  storageOpts?: any,
): { store: ConnextStore; storage: Storage | IAsyncStorage } {
  let storage;

  switch (type.toUpperCase()) {
    case LOCALSTORAGE:
      storage = localStorage;
      break;

    case ASYNCSTORAGE:
      storage = new MockAsyncStorage(storageOpts);
      break;

    case FILESTORAGE:
      storage = new FileStorage(storageOpts);
      break;

    case MEMORYSTORAGE:
      storage = new MemoryStorage(storageOpts);
      break;

    default:
      throw new Error(`Unable to create test store of type: ${type}`);
  }

  const store = new ConnextStore(storage, opts);
  expect(store).to.be.instanceOf(ConnextStore);

  return { store, storage };
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
  store: ConnextStore,
  pair: StorePair = TEST_STORE_PAIR,
): Promise<void> {
  await store.set([pair]);
  const value = await store.get(pair.path);
  if (typeof pair.value === "object" && !BigNumber.isBigNumber(pair.value)) {
    expect(value).to.be.deep.equal(pair.value);
    return;
  }
  expect(value).to.be.equal(pair.value);
}

export async function setAndGetMultiple(store: ConnextStore, length: number = 10): Promise<void> {
  const pairs = generateStorePairs(length);
  expect(pairs.length).to.equal(length);
  await store.set(pairs);
  await Promise.all(
    pairs.map(
      async (pair: StorePair, index: number): Promise<void> => {
        const value = await store.get(pair.path);
        expect(value).to.be.equal(pairs[index].value);
      },
    ),
  );
}

export async function testAsyncStorageKey(
  storage: IAsyncStorage,
  asyncStorageKey: string,
): Promise<void> {
  const keys = await storage.getAllKeys();
  expect(keys.length).to.equal(1);
  expect(keys[0]).to.equal(asyncStorageKey);
}
