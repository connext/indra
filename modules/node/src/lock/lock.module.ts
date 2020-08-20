import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { MessagingModule } from "../messaging/messaging.module";
import { RedisModule } from "../redis/redis.module";
import { ConfigModule } from "../config/config.module";

import { lockProviderFactory } from "./lock.provider";
import { LockService } from "./lock.service";
import { LoggerModule } from "nestjs-pino";

@Module({
  exports: [LockService, lockProviderFactory],
  imports: [AuthModule, MessagingModule, RedisModule, ConfigModule, LoggerModule],
  providers: [LockService, lockProviderFactory],
})
export class LockModule {}
