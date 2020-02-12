import { IAsyncStorage } from "../helpers";

export class MemoryStorage implements IAsyncStorage {
  private store: Map<string, any> = new Map();
  private delay: number;

  constructor(delay: number = 0) {
    this.delay = delay;
  }

  handleDelay(): Promise<void> {
    return new Promise(res => setTimeout(() => res(), this.delay));
  }

  async getItem(key: string): Promise<string | null> {
    await this.handleDelay();
    if (this.store.has(key)) {
      return this.store.get(key);
    }
    return null;
  }
  async setItem(key: string, data: any): Promise<void> {
    await this.handleDelay();
    this.store.set(key, data);
  }

  async removeItem(key: string): Promise<void> {
    await this.handleDelay();
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store = new Map();
  }

  async getChannels(): Promise<object> {
    const channelsObj = Object.entries(this.store).reduce((channels, [path, value]) => {
      if (path.includes("channel")) {
        channels[value.multisigAddress] = value;
      }
      return channels;
    }, {});
    return channelsObj;
  }

  async getAllKeys(): Promise<string[]> {
    return Array.from(this.store.keys());
  }
}
