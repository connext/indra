import { Module } from "@nestjs/common";

import { ConfigModule } from "../config/config.module";

import { messagingClientFactory, messagingProviderFactory } from "./messaging.provider";

@Module({
  exports: [messagingClientFactory, messagingProviderFactory],
  imports: [ConfigModule],
  providers: [messagingClientFactory, messagingProviderFactory],
})
export class MessagingModule {}
