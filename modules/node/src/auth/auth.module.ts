import { Module } from "@nestjs/common";

import { MessagingModule } from "../messaging/messaging.module";
import { RedisModule } from "../redis/redis.module";

import { authProviderFactory } from "./auth.provider";
import { AuthService } from "./auth.service";

@Module({
  exports: [AuthService, authProviderFactory],
  imports: [RedisModule, MessagingModule],
  providers: [AuthService, authProviderFactory],
})
export class AuthModule {}
