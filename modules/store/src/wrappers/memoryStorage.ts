import { safeJsonParse, safeJsonStringify } from "@connext/utils";

import { storeDefaults } from "../constants";
import { WrappedStorage } from "../types";

export class WrappedMemoryStorage implements WrappedStorage {
  private storage: Map<string, string> = new Map();

  constructor(
    private readonly prefix: string = storeDefaults.PREFIX,
    private readonly separator: string = storeDefaults.SEPARATOR,
  ) {}

  init(): Promise<void> {
    return Promise.resolve();
  }

  async getItem<T>(key: string): Promise<T | undefined> {
    const path = `${this.prefix}${this.separator}${key}`;
    if (!this.storage.has(path)) {
      return undefined;
    }
    const item = this.storage.get(path);
    return safeJsonParse(item);
  }

  async setItem<T>(key: string, value: T): Promise<void> {
    this.storage.set(`${this.prefix}${this.separator}${key}`, safeJsonStringify(value));
  }

  async removeItem(key: string): Promise<void> {
    this.storage.delete(`${this.prefix}${this.separator}${key}`);
  }

  async getKeys(): Promise<string[]> {
    const relevantKeys = [...this.storage.keys()].filter((key) => key.startsWith(this.prefix));
    return relevantKeys.map((key) => key.split(`${this.prefix}${this.separator}`)[1]);
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

  getKey(...args: string[]) {
    return args.join(this.separator);
  }
}
