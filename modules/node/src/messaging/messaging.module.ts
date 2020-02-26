import { Module } from "@nestjs/common";

import { ConfigModule } from "../config/config.module";
import { LoggerModule } from "../logger/logger.module";

import { messagingClientFactory, messagingProviderFactory } from "./messaging.provider";

@Module({
  exports: [messagingClientFactory, messagingProviderFactory],
  imports: [ConfigModule, LoggerModule],
  providers: [messagingClientFactory, messagingProviderFactory],
})
export class MessagingModule {}
