import { Module } from "@nestjs/common";

import { ConfigModule } from "../config/config.module";

import { messagingClient } from "./messaging.provider";

@Module({
  exports: [messagingClient],
  imports: [ConfigModule],
  providers: [messagingClient],
})
export class MessagingModule {}
