import {
  AsyncStorageData,
  IAsyncStorage,
  InitCallback,
  REACT_NATIVE_STORE,
  safeJsonParse,
  safeJsonStringify,
  StorageWrapper,
} from "../helpers";

export class AsyncStorageWrapper implements StorageWrapper {
  private asyncStorage: IAsyncStorage;
  private data: AsyncStorageData = {};
  private initializing: boolean = false;
  private initCallbacks: InitCallback[] = [];

  constructor(asyncStorage: IAsyncStorage) {
    this.asyncStorage = asyncStorage;
    this.loadData();
  }

  loadData(): Promise<AsyncStorageData> {
    return new Promise(
      async (resolve, reject): Promise<void> => {
        if (this.initializing) {
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

  async getItem(key: string): Promise<string | null> {
    await this.loadData();
    const result = this.data[`${key}`] || null;
    return result;
  }

  async setItem(key: string, value: string): Promise<void> {
    await this.loadData();
    this.data[key] = value;
    await this.persist();
  }

  async removeItem(key: string): Promise<void> {
    await this.loadData();
    delete this.data[key];
    await this.persist();
  }

  async persist(): Promise<void> {
    await this.asyncStorage.setItem(REACT_NATIVE_STORE, safeJsonStringify(this.data));
  }

  async fetch(): Promise<AsyncStorageData> {
    const data = await this.asyncStorage.getItem(REACT_NATIVE_STORE);
    return safeJsonParse(data) || {};
  }

  async clear(): Promise<void> {
    await this.asyncStorage.removeItem(REACT_NATIVE_STORE);
  }

  async getKeys(): Promise<string[]> {
    return Object.keys(this.data);
  }

  async getEntries(): Promise<[string, any][]> {
    return Object.entries(this.data);
  }
}
