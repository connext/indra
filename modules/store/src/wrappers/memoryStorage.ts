import {
  IBackupServiceAPI,
  WrappedStorage,
} from "@connext/types";
import { safeJsonParse, safeJsonStringify } from "@connext/utils";
import { CHANNEL_KEY, COMMITMENT_KEY, DEFAULT_STORE_PREFIX, DEFAULT_STORE_SEPARATOR } from "src/constants";

export class WrappedMemoryStorage implements WrappedStorage {

  private storage: Map<string, string> = new Map();

  constructor(
    private readonly prefix: string = DEFAULT_STORE_PREFIX,
    private readonly separator: string = DEFAULT_STORE_SEPARATOR,
    private readonly backupService?: IBackupServiceAPI,
  ) {}

  async getItem<T>(key: string): Promise<T | undefined> {
    const path = `${this.prefix}${this.separator}${key}`;
    if (!this.storage.has(path)) {
      return undefined;
    }
    const item = this.storage.get(path);
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
    this.storage.set(`${this.prefix}${this.separator}${key}`, safeJsonStringify(value));
  }

  async removeItem(key: string): Promise<void> {
    this.storage.delete(`${this.prefix}${this.separator}${key}`);
  }

  async getKeys(): Promise<string[]> {
    const relevantKeys = [...this.storage.keys()].filter(key => key.startsWith(this.prefix));
    return relevantKeys.map(key => key.split(`${this.prefix}${this.separator}`)[1]);
  }

  async getEntries(): Promise<[string, any][]> {
    return [...this.storage.entries()]
      .filter(([name, _]) => name.startsWith(this.prefix))
      .map(([name, value]) => [
        name.replace(`${this.prefix}${this.separator}`, ""),
        safeJsonParse(value),
      ]);
  }

  async clear(): Promise<void> {
    this.storage = new Map();
    return Promise.resolve();
  }

  // NOTE: the backup service should store only the key without prefix.
  // see the `setItem` implementation
  async restore(): Promise<void> {
    await this.clear();
    if (!this.backupService) {
      throw new Error(`No backup provided, store cleared`);
    }
    throw new Error(`Method not implemented for MemoryStorage`);
  }

  getKey(...args: string[]) {
    return args.join(this.separator);
  }
}
