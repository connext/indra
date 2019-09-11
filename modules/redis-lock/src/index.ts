import { Node } from "@counterfactual/types";
import { createHandyClient, IHandyRedis } from "handy-redis";

export class RedisLockService implements Node.ILockService {
  private client?: IHandyRedis;

  constructor(redisUrl: string) {
    this.client = createHandyClient({ url: redisUrl });
  }
  async get(path: string): Promise<Node.Lock> {
    const stringified = await this.client!.get(path);
    if (!stringified) {
      return {
        locked: false,
        operation: "",
      } as Node.Lock;
    }
    return JSON.parse(stringified);
  }

  async set(path: string, value: Node.Lock): Promise<void> {
    await this.client!.set(path, JSON.stringify(value));
  }
}
