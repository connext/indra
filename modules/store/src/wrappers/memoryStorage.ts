import { WrappedStorage } from "@connext/types";
import { safeJsonParse, safeJsonStringify } from "@connext/utils";

import { DEFAULT_STORE_PREFIX, DEFAULT_STORE_SEPARATOR } from "..";

export class MemoryStorage implements WrappedStorage {
  private storage: Map<string, any> = new Map();

  constructor(
    private readonly prefix: string = DEFAULT_STORE_PREFIX,
    private readonly separator: string = DEFAULT_STORE_SEPARATOR,
  ) {}

  async getItem<T = any>(key: string): Promise<T> {
    const item = this.storage.get(`${this.prefix}${this.separator}${key}`);
    return safeJsonParse(item);
  }

  async setItem<T = any>(key: string, value: T): Promise<void> {
    this.storage.set(`${this.prefix}${this.separator}${key}`, safeJsonStringify(value));
  }

  async removeItem(key: string): Promise<void> {
    this.storage.delete(`${this.prefix}${this.separator}${key}`);
  }

  async getKeys(): Promise<string[]> {
    const relevantKeys = Array.from(this.storage.keys()).filter(key => key.startsWith(this.prefix));
    return relevantKeys.map(key => key.split(`${this.prefix}${this.separator}`)[1]);
  }

  async getEntries(): Promise<[string, any][]> {
    return Array.from(this.storage.entries())
      .filter(([name, _]) => name.startsWith(this.prefix))
      .map(([name, value]) => [
        name.replace(`${this.prefix}${this.separator}`, ""),
        safeJsonParse(value),
      ]);
  }
  async clear(): Promise<void> {
    this.storage.clear();
  }

  restore(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  getKey(...args: string[]): string {
    return args.join(this.separator);
  }
}
