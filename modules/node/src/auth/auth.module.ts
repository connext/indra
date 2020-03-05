import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { ChannelRepository } from "../channel/channel.repository";
import { LoggerModule } from "../logger/logger.module";
import { ConfigModule } from "../config/config.module";

import { AuthService } from "./auth.service";
import { messagingAuthProviderFactory } from "./auth.provider";

@Module({
  exports: [AuthService, messagingAuthProviderFactory],
  imports: [LoggerModule, TypeOrmModule.forFeature([ChannelRepository]), ConfigModule],
  providers: [AuthService, messagingAuthProviderFactory],
})
export class AuthModule {}
