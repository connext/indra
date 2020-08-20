import { Module } from "@nestjs/common";

import { ConfigModule } from "../config/config.module";
import { AuthModule } from "../auth/auth.module";

import { messagingProviderFactory } from "./messaging.provider";
import { LoggerModule } from "nestjs-pino";

@Module({
  exports: [messagingProviderFactory],
  imports: [ConfigModule, AuthModule, LoggerModule],
  providers: [messagingProviderFactory],
})
export class MessagingModule {}
