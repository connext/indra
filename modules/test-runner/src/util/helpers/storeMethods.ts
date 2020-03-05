import {
  ConnextStore,
  safeJsonParse,
  safeJsonStringify,
  DEFAULT_STORE_PREFIX,
  DEFAULT_STORE_SEPARATOR,
  DEFAULT_ASYNC_STORAGE_KEY,
  KeyValueStorage,
  WrappedLocalStorage,
  FileStorage,
} from "@connext/store";
import {
  IAsyncStorage,
  StoreFactoryOptions,
  StorePair,
  StoreType,
  StoreTypes,
  ASYNCSTORAGE,
  WrappedStorage,
  AsyncStorageData,
  InitCallback,
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
        new MockAsyncWrappedStorage(opts.prefix, opts.separator, opts.asyncStorageKey),
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
    const store = new KeyValueStorage(
      new MockAsyncWrappedStorage(opts.prefix, opts.separator, opts.asyncStorageKey),
    );
    expect(store).to.be.instanceOf(KeyValueStorage);
    return store as any; // still implements IStoreService
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

export class MockAsyncWrappedStorage implements WrappedStorage {
  private asyncStorage: IAsyncStorage;
  private data: AsyncStorageData = {};
  private initializing: boolean = false;
  private initCallbacks: InitCallback[] = [];

  constructor(
    private readonly prefix: string = DEFAULT_STORE_PREFIX,
    private readonly separator: string = DEFAULT_STORE_SEPARATOR,
    private readonly asyncStorageKey: string = DEFAULT_ASYNC_STORAGE_KEY,
  ) {
    this.asyncStorage = new MockAsyncStorage();
    this.loadData();
  }

  loadData(): Promise<AsyncStorageData> {
    return new Promise(
      async (resolve, reject): Promise<void> => {
        if (this.initializing) {
          // @ts-ignore
          this.onInit((cb: InitCallback) => resolve(cb));
        } else {
          try {
            this.initializing = true;
            this.data = await this.fetch();
            this.initializing = false;
            resolve(this.data);
            this.triggerInit(this.data);
          } catch (e) {
            this.initializing = false;
            reject(e);
          }
        }
      },
    );
  }

  onInit(callback: InitCallback): void {
    this.initCallbacks.push(callback);
  }

  triggerInit(data: AsyncStorageData): void {
    if (this.initCallbacks && this.initCallbacks.length) {
      this.initCallbacks.forEach((callback: InitCallback) => callback(data));
    }
  }

  async getItem(key: string) {
    await this.loadData();
    const result = this.data[`${this.prefix}${this.separator}${key}`] || undefined;
    return result as any;
  }

  async setItem(key: string, value: string): Promise<void> {
    await this.loadData();
    this.data[`${this.prefix}${this.separator}${key}`] = value;
    await this.persist();
  }

  async removeItem(key: string): Promise<void> {
    await this.loadData();
    delete this.data[`${this.prefix}${this.separator}${key}`];
    await this.persist();
  }

  async persist(): Promise<void> {
    await this.asyncStorage.setItem(this.asyncStorageKey, safeJsonStringify(this.data));
  }

  async fetch(): Promise<AsyncStorageData> {
    const data = await this.asyncStorage.getItem(this.asyncStorageKey);
    return safeJsonParse(data) || {};
  }

  async getKeys(): Promise<string[]> {
    const relevantKeys = Object.keys(this.data).filter(key => key.startsWith(this.prefix));
    return relevantKeys.map(key => key.split(`${this.prefix}${this.separator}`)[1]);
  }

  async getEntries(): Promise<[string, any][]> {
    return Object.entries(this.data).filter(([name, _]) => name.startsWith(this.prefix));
  }

  clear(): Promise<void> {
    return this.asyncStorage.removeItem(this.asyncStorageKey);
  }

  restore(): Promise<void> {
    return this.clear();
  }

  joinWithSeparator(...args: string[]): string {
    let str = "";
    args.forEach(arg => {
      // dont add separator to last one
      if (args.indexOf(arg) === args.length - 1) {
        return;
      }
      str.concat(arg, this.separator);
    });
    return str;
  }
}
