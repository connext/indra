import {
  DEFAULT_STORE_PREFIX,
  DEFAULT_STORE_SEPARATOR,
  CHANNEL_KEY,
  COMMITMENT_KEY,
} from "../helpers";
import { IBackupServiceAPI, WrappedStorage } from "@connext/types";
import localStorage from "localStorage";

export class WrappedLocalStorage implements WrappedStorage {
  private localStorage: Storage = localStorage;

  constructor(
    private readonly prefix: string = DEFAULT_STORE_PREFIX,
    private readonly separator: string = DEFAULT_STORE_SEPARATOR,
    private readonly backupService?: IBackupServiceAPI,
  ) {}

  async getItem(key: string): Promise<string | undefined> {
    const item = this.localStorage.getItem(`${this.prefix}${this.separator}${key}`);
    return item || undefined;
  }

  async setItem(key: string, value: string): Promise<void> {
    const shouldBackup = key.includes(CHANNEL_KEY) || key.includes(COMMITMENT_KEY);
    if (this.backupService && shouldBackup) {
      await this.backupService.backup({ path: key, value });
    }
    this.localStorage.setItem(`${this.prefix}${this.separator}${key}`, value);
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
      .map(([name, value]) => [name.replace(`${this.prefix}${this.separator}`, ""), value]);
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
    pairs.forEach(pair => this.setItem(pair.path, pair.value));
  }

  joinWithSeparator(...args: string[]) {
    let str = "";
    args.forEach(arg => {
      // dont add separator to last one
      str = str.concat(arg, args.indexOf(arg) === args.length - 1 ? "" : this.separator);
    });
    return str;
  }
}

export default WrappedLocalStorage;
