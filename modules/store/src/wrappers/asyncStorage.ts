import {
  AsyncStorageData,
  DEFAULT_ASYNC_STORAGE_KEY,
  InitCallback,
  safeJsonParse,
  safeJsonStringify,
  DEFAULT_STORE_PREFIX,
  DEFAULT_STORE_SEPARATOR,
  CHANNEL_KEY,
  COMMITMENT_KEY,
} from "../helpers";
import { IAsyncStorage, IBackupServiceAPI, WrappedStorage } from "@connext/types";

export class WrappedAsyncStorage implements WrappedStorage {
  private data: AsyncStorageData = {};
  private initializing: boolean = false;
  private initCallbacks: InitCallback[] = [];

  constructor(
    private readonly asyncStorage: IAsyncStorage,
    private readonly prefix: string = DEFAULT_STORE_PREFIX,
    private readonly separator: string = DEFAULT_STORE_SEPARATOR,
    private readonly asyncStorageKey: string = DEFAULT_ASYNC_STORAGE_KEY,
    private readonly backupService?: IBackupServiceAPI,
  ) {
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

  async getItem(key: string): Promise<string | undefined> {
    await this.loadData();
    const result = this.data[`${this.prefix}${this.separator}${key}`] || undefined;
    return result;
  }

  async setItem(key: string, value: string): Promise<void> {
    await this.loadData();
    const shouldBackup = key.includes(CHANNEL_KEY) || key.includes(COMMITMENT_KEY);
    if (this.backupService && shouldBackup) {
      await this.backupService.backup({ path: key, value });
    }
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
    return relevantKeys.map(key => key.replace(`${this.prefix}${this.separator}`, ""));
  }

  async getEntries(): Promise<[string, any][]> {
    return Object.entries(this.data)
      .filter(([name, _]) => name.startsWith(this.prefix))
      .map(([name, _]) => [name.replace(`${this.prefix}${this.separator}`, ""), _]);
  }

  async clear(): Promise<void> {
    this.data = {};
    await this.asyncStorage.removeItem(this.asyncStorageKey);
  }

  async restore(): Promise<void> {
    await this.clear();
    if (!this.backupService) {
      throw new Error(`No backup provided, store cleared`);
    }
    const pairs = await this.backupService.restore();
    await Promise.all(pairs.map(pair => this.setItem(pair.path, pair.value)));
  }

  joinWithSeparator(...args: string[]): string {
    let str = "";
    args.forEach(arg => {
      // dont add separator to last one
      str = str.concat(arg, args.indexOf(arg) === args.length - 1 ? "" : this.separator);
    });
    return str;
  }
}
