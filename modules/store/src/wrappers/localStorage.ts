import { IBackupServiceAPI, WrappedStorage } from "@connext/types";
import { safeJsonParse, safeJsonStringify } from "@connext/utils"; 

import {
  DEFAULT_STORE_PREFIX,
  DEFAULT_STORE_SEPARATOR,
  CHANNEL_KEY,
  COMMITMENT_KEY,
} from "../helpers";

// @ts-ignore
const getLocalStorage = () => global.localStorage || require("localStorage");
export class WrappedLocalStorage implements WrappedStorage {
  private localStorage: Storage = getLocalStorage();

  constructor(
    private readonly prefix: string = DEFAULT_STORE_PREFIX,
    private readonly separator: string = DEFAULT_STORE_SEPARATOR,
    private readonly backupService?: IBackupServiceAPI,
  ) {}

  async getItem<T>(key: string): Promise<T | undefined> {
    const item = this.localStorage.getItem(`${this.prefix}${this.separator}${key}`);
    return safeJsonParse(item);
  }

  async setItem<T>(key: string, value: T): Promise<void> {
    const shouldBackup = key.includes(CHANNEL_KEY) || key.includes(COMMITMENT_KEY);
    if (this.backupService && shouldBackup) {
      try {
        await this.backupService.backup({ path: key, value });
      } catch (e) {
        console.info(`Could not save ${key} to backup service. Error: ${e.stack || e.message}`);
      }
    }
    this.localStorage.setItem(`${this.prefix}${this.separator}${key}`, safeJsonStringify(value));
  }

  async removeItem(key: string): Promise<void> {
    this.localStorage.removeItem(`${this.prefix}${this.separator}${key}`);
  }

  async getKeys(): Promise<string[]> {
    const relevantKeys = Object.keys(this.localStorage).filter(key => key.startsWith(this.prefix));
    return relevantKeys.map(key => key.split(`${this.prefix}${this.separator}`)[1]);
  }

  async getEntries(): Promise<[string, any][]> {
    return Object.entries(this.localStorage)
      .filter(([name, _]) => name.startsWith(this.prefix))
      .map(([name, value]) => [name.replace(`${this.prefix}${this.separator}`, ""), safeJsonParse(value)]);
  }

  async clear(): Promise<void> {
    const keys = await this.getKeys();
    keys.forEach(key => this.removeItem(key));
  }

  // NOTE: the backup service should store only the key without prefix.
  // see the `setItem` implementation
  async restore(): Promise<void> {
    await this.clear();
    if (!this.backupService) {
      throw new Error(`No backup provided, store cleared`);
    }
    const pairs = await this.backupService.restore();
    await Promise.all(pairs.map(pair => this.setItem(pair.path, pair.value)));
  }

  getKey(...args: string[]) {
    return args.join(this.separator);
  }
}

export default WrappedLocalStorage;
