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

  async set<T = any>(key: string, expiry: number, value: T): Promise<any> {
    return this.redis.set(key, JSON.stringify(value), "EX", expiry);
  }

  async del(key: string): Promise<any> {
    return this.redis.del(key);
  }

  async deleteAll(): Promise<any> {
    return this.redis.flushall();
  }

  async wrap<T, U>(
    key: string,
    expiry: number,
    cb: () => Promise<U>,
    ser: JSONSerializer<U, T>,
  ): Promise<T | undefined> {
    const cached = await this.redis.get(key);
    if (cached) {
      return JSON.parse(cached);
    }
    const val = await cb();
    if (!val) {
      return undefined;
    }
    await this.redis.set(key, JSON.stringify(ser.toJSON(val)), "EX", expiry);
    return ser.toJSON(val);
  }

  async mergeCacheValues<T = any>(key: string, expiry: number, toMerge: Partial<T>): Promise<void> {
    return this.mergeCacheValuesFn(key, expiry, (parsed) => Object.assign(parsed, toMerge));
  }

  async mergeCacheValuesFn<T = any>(
    key: string,
    expiry: number,
    mergeFn: (merge: T) => T,
  ): Promise<void> {
    const cached = await this.redis.get(key);
    if (!cached) {
      return;
    }
    const parsed = JSON.parse(cached);
    await this.redis.set(key, JSON.stringify(mergeFn(parsed)), "EX", expiry);
  }
}
