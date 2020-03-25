import { Module } from "@nestjs/common";

import { ConfigModule } from "../config/config.module";
import { LoggerModule } from "../logger/logger.module";
import { AuthModule } from "../auth/auth.module";

import { messagingProviderFactory } from "./messaging.provider";

@Module({
  exports: [messagingProviderFactory],
  imports: [ConfigModule, LoggerModule, AuthModule],
  providers: [messagingProviderFactory],
})
export class MessagingModule {}
