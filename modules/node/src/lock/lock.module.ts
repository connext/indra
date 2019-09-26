import { Module } from "@nestjs/common";

import { MessagingModule } from "../messaging/messaging.module";
import { RedisModule } from "../redis/redis.module";

import { lockProviderFactory } from "./lock.provider";
import { LockService } from "./lock.service";

@Module({
  exports: [LockService, lockProviderFactory],
  imports: [RedisModule, MessagingModule],
  providers: [LockService, lockProviderFactory],
})
export class LockModule {}
