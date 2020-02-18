import { WrappedStorage, reduceChannelsMap, ChannelsMap } from "../helpers";

export class WrappedLocalStorage implements WrappedStorage {
  private localStorage: Storage;

  constructor(localStorage: Storage) {
    this.localStorage = localStorage;
  }

  async getItem(key: string): Promise<string | null> {
    return this.localStorage.getItem(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    this.localStorage.setItem(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.localStorage.removeItem(key);
  }

  async getKeys(): Promise<string[]> {
    return Object.keys(this.localStorage);
  }

  async getEntries(): Promise<[string, any][]> {
    return Object.entries(this.localStorage);
  }

  async getChannels(): Promise<ChannelsMap> {
    const entries = await this.getEntries();
    const channelsObj = reduceChannelsMap(entries);
    return channelsObj;
  }

  async clear(prefix: string): Promise<void> {
    const entries = await this.getEntries();
    entries.forEach(async ([key, value]: [string, any]) => {
      if (key.includes(prefix)) {
        await this.removeItem(key);
      }
    });
  }
}

export default WrappedLocalStorage;
