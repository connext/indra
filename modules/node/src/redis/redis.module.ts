import { Module } from "@nestjs/common";

import { ConfigModule } from "../config/config.module";

import { redisClientFactory, redlockClientFactory } from "./redis.provider";

@Module({
  exports: [redisClientFactory, redlockClientFactory],
  imports: [ConfigModule],
  providers: [redisClientFactory, redlockClientFactory],
})
export class RedisModule {}
