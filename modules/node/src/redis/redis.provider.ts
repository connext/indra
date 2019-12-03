import { FactoryProvider } from "@nestjs/common/interfaces";
import Redis from "ioredis";
import Redlock from "redlock";

import { ConfigService } from "../config/config.service";
import { RedisProviderId, RedlockProviderId } from "../constants";
import { CLogger } from "../util";

const logger = new CLogger("RedisService");

export const redisClientFactory: FactoryProvider = {
  inject: [ConfigService],
  provide: RedisProviderId,
  useFactory: (config: ConfigService): Redis.Redis => {
    const redisClient = new Redis(config.getRedisUrl(), {
      retryStrategy: (times: number): number => {
        logger.warn("Lost connection to redis. Retrying to connect...");
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });
    return redisClient;
  },
};

export const redlockClientFactory: FactoryProvider = {
  inject: [RedisProviderId],
  provide: RedlockProviderId,
  useFactory: (redis: Redis.Redis): Redlock => {
    const redlockClient = new Redlock([redis], {
      // the expected clock drift; for more details
      // see http://redis.io/topics/distlock
      driftFactor: 0.01, // time in ms

      // the max number of times Redlock will attempt
      // to lock a resource before erroring
      retryCount: 700,

      // the time in ms between attempts
      retryDelay: 100, // time in ms

      // the max time in ms randomly added to retries
      // to improve performance under high contention
      // see https://www.awsarchitectureblog.com/2015/03/backoff.html
      retryJitter: 5000, // time in ms
    });

    redlockClient.on("clientError", (err: any) => {
      console.error("A redis error has occurred:", err);
    });

    return redlockClient;
  },
};
