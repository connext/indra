import { Module } from "@nestjs/common";

import { ConfigModule } from "../config/config.module";

import { redisClientFactory, redlockClientFactory } from "./redis.provider";
import { LoggerModule } from "nestjs-pino";

@Module({
  exports: [redisClientFactory, redlockClientFactory],
  imports: [ConfigModule, LoggerModule],
  providers: [redisClientFactory, redlockClientFactory],
})
export class RedisModule {}
