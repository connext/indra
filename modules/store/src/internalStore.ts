import {
  IAsyncStorage,
  safeJsonParse,
  safeJsonStringify,
  StorageWrapper,
  wrapStorage,
} from "./helpers";

class InternalStore {
  private _store: StorageWrapper;
  private _channelPrefix: string;

  constructor(storage: Storage | IAsyncStorage, channelPrefix: string, asyncStorageKey?: string) {
    this._store = wrapStorage(storage, asyncStorageKey);
    this._channelPrefix = channelPrefix;
  }

  async getStore(): Promise<StorageWrapper> {
    if (!this._store) {
      throw new Error("Store is not available");
    }
    return this._store;
  }

  async getItem(path: string): Promise<string | null> {
    const store = await this.getStore();
    let result = await store.getItem(`${path}`);
    if (result) {
      result = safeJsonParse(result);
    }
    return result;
  }

  async setItem(path: string, value: any): Promise<void> {
    const store = await this.getStore();
    await store.setItem(`${path}`, safeJsonStringify(value));
  }

  async removeItem(path: string): Promise<void> {
    const store = await this.getStore();
    await store.removeItem(`${path}`);
  }

  async getKeys(): Promise<string[]> {
    const store = await this.getStore();
    const keys = await store.getKeys();
    return keys;
  }

  async getEntries(): Promise<[string, any][]> {
    const store = await this.getStore();
    const entries = await store.getEntries();
    return entries;
  }

  async clear(): Promise<void> {
    const store = await this.getStore();
    await store.clear(this._channelPrefix);
  }
}

export default InternalStore;
