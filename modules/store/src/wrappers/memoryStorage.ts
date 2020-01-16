import { EMPTY_STRINGIFIED_DATA, IAsyncStorage } from "../helpers";

export class MemoryStorage implements IAsyncStorage {
  private delay: number;

  constructor(delay: number = 0) {
    this.delay = delay;
  }

  handleDelay(): Promise<void> {
    return new Promise(res => setTimeout(() => res(), this.delay));
  }

  async getItem(key: string): Promise<string | null> {
    await this.handleDelay();
    return EMPTY_STRINGIFIED_DATA;
  }
  async setItem(key: string, data: any): Promise<void> {
    await this.handleDelay();
  }

  async removeItem(key: string): Promise<void> {
    await this.handleDelay();
  }
}
