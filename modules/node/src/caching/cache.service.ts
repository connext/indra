import { Inject } from "@nestjs/common";
import Redis from "ioredis";
import { JSONSerializer } from "@connext/types";
import { RedisProviderId } from "../constants";
import { LoggerService } from "../logger/logger.service";

export class CacheService {
  constructor(
    @Inject(RedisProviderId) private readonly redis: Redis.Redis,
    private readonly log: LoggerService,
  ) {
    this.log.setContext("Cache");
  }

  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async set(key: string, expiry: number, value: any): Promise<void> {
    return this.redis.set(key, JSON.stringify(value), "EX", expiry);
  }

  async del(key: string): Promise<void> {
    return this.redis.del(key);
  }

  async wrap<T>(
    key: string,
    expiry: number,
    cb: () => Promise<T>,
    ser: JSONSerializer<T, any>,
  ): Promise<T> {
    const cached = await this.redis.get(key);
    if (cached) {
      return ser.fromJSON(JSON.parse(cached));
    }
    const val = await cb();
    if (!val) {
      return val;
    }
    await this.redis.set(key, JSON.stringify(ser.toJSON(val)), "EX", expiry);
    return val;
  }

  async mergeCacheValues(key: string, expiry: number, toMerge: object): Promise<void> {
    return this.mergeCacheValuesFn(key, expiry, (parsed) => Object.assign(parsed, toMerge));
  }

  async mergeCacheValuesFn(key: string, expiry: number, mergeFn: (merge: any) => any) {
    const cached = await this.redis.get(key);
    if (!cached) {
      return;
    }
    const parsed = JSON.parse(cached);
    await this.redis.set(key, JSON.stringify(mergeFn(parsed)), "EX", expiry);
  }
}
