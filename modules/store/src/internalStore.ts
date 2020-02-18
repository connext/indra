import {
  IAsyncStorage,
  safeJsonParse,
  safeJsonStringify,
  WrappedStorage,
  wrapStorage,
  ChannelsMap,
} from "./helpers";

class InternalStore {
  private wrappedStorage: WrappedStorage;
  private channelPrefix: string;

  constructor(storage: Storage | IAsyncStorage, channelPrefix: string, asyncStorageKey?: string) {
    this.wrappedStorage = wrapStorage(storage, asyncStorageKey);
    this.channelPrefix = channelPrefix;
  }

  async getStore(): Promise<WrappedStorage> {
    if (!this.wrappedStorage) {
      throw new Error("Store is not available");
    }
    return this.wrappedStorage;
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

  async getChannels(): Promise<ChannelsMap> {
    const store = await this.getStore();
    const channels = await store.getChannels();
    return channels;
  }

  async getEntries(): Promise<[string, any][]> {
    const store = await this.getStore();
    const entries = await store.getEntries();
    return entries;
  }

  async clear(): Promise<void> {
    const store = await this.getStore();
    await store.clear(this.channelPrefix);
  }
}

export default InternalStore;
