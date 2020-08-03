import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { LoggerModule } from "../logger/logger.module";
import { MessagingModule } from "../messaging/messaging.module";
import { RedisModule } from "../redis/redis.module";
import { ConfigModule } from "../config/config.module";

import { lockProviderFactory } from "./lock.provider";
import { LockService } from "./lock.service";

@Module({
  exports: [LockService, lockProviderFactory],
  imports: [AuthModule, LoggerModule, MessagingModule, RedisModule, ConfigModule],
  providers: [LockService, lockProviderFactory],
})
export class LockModule {}
