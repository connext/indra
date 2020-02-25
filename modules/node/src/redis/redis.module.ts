import { Module } from "@nestjs/common";

import { LoggerModule } from "../logger/logger.module";
import { ConfigModule } from "../config/config.module";

import { redisClientFactory, redlockClientFactory } from "./redis.provider";

@Module({
  exports: [redisClientFactory, redlockClientFactory],
  imports: [ConfigModule, LoggerModule],
  providers: [redisClientFactory, redlockClientFactory],
})
export class RedisModule {}
