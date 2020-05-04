import { WrappedStorage } from "@connext/types";
import { safeJsonParse, safeJsonStringify } from "@connext/utils";

import {
  DEFAULT_STORE_PREFIX,
  DEFAULT_STORE_SEPARATOR,
} from "../constants";

// @ts-ignore
const getLocalStorage = () => global.localStorage || require("localStorage");
export class WrappedLocalStorage implements WrappedStorage {
  private localStorage: Storage = getLocalStorage();

  constructor(
    private readonly prefix: string = DEFAULT_STORE_PREFIX,
    private readonly separator: string = DEFAULT_STORE_SEPARATOR,
  ) {}

  async getItem<T>(key: string): Promise<T | undefined> {
    const item = this.localStorage.getItem(`${this.prefix}${this.separator}${key}`);
    return safeJsonParse(item);
  }

  async setItem<T>(key: string, value: T): Promise<void> {
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
      .map(([name, value]) => [
        name.replace(`${this.prefix}${this.separator}`, ""),
        safeJsonParse(value),
      ]);
  }

  getKey(...args: string[]) {
    return args.join(this.separator);
  }
}

export default WrappedLocalStorage;
