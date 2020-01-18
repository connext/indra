import { ConnextStore, FileStorage, MemoryStorage } from "@connext/store";
import { IAsyncStorage, StoreFactoryOptions, StorePair } from "@connext/types";
import { BigNumber } from "ethers/utils";
import localStorage from "localStorage";
import MockAsyncStorage from "mock-async-storage";
import uuid from "uuid";

import { expect } from "../";

const TEST_STORE_PAIR: StorePair = { path: "testing", value: "something" };

const StoreTypes = {
  asyncstorage: "asyncstorage",
  filestorage: "filestorage",
  localstorage: "localstorage",
  memorystorage: "memorystorage",
};
type StoreType = keyof typeof StoreTypes;

export function createStore(
  type: StoreType,
  opts?: StoreFactoryOptions,
  storageOpts?: any,
): { store: ConnextStore; storage: Storage | IAsyncStorage } {
  let storage;

  switch (type.toLowerCase()) {
    case "localstorage":
      storage = localStorage;
      break;

    case "asyncstorage":
      storage = new MockAsyncStorage(storageOpts);
      break;

    case "filestorage":
      storage = new FileStorage(storageOpts);
      break;

    case "memorystorage":
      storage = new MemoryStorage(storageOpts);
      break;

    default:
      throw new Error(`Unable to create test store of type: ${type}`);
  }

  const store = new ConnextStore(storage, opts);
  expect(store).to.be.instanceOf(ConnextStore);

  return { store, storage };
}

export function generateStorePairs(length: number = 10): StorePair[] {
  return Array.from(Array(length)).map(
    (): StorePair => {
      const id = uuid.v1();
      return { path: id, value: id };
    },
  );
}

export async function setAndGet(
  store: ConnextStore,
  storePair: StorePair = TEST_STORE_PAIR,
): Promise<void> {
  await store.set([storePair]);
  const value = await store.get(storePair.path);
  if (typeof storePair.value === "object" && !BigNumber.isBigNumber(storePair.value)) {
    expect(value).to.be.deep.equal(storePair.value);
    return;
  }
  expect(value).to.be.equal(storePair.value);
}

export async function setAndGetMultiple(store: ConnextStore, length: number = 10): Promise<void> {
  const pairs = generateStorePairs(length);
  expect(pairs.length).to.equal(length);
  for (const pair of pairs) {
    await setAndGet(store, pair);
  }
}

export async function testAsyncStorageKey(
  storage: IAsyncStorage,
  asyncStorageKey: string,
): Promise<void> {
  const keys = await storage.getAllKeys();
  expect(keys.length).to.equal(1);
  expect(keys[0]).to.equal(asyncStorageKey);
}
