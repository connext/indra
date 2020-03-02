import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { ChannelRepository } from "../channel/channel.repository";
import { LoggerModule } from "../logger/logger.module";
import { MessagingModule } from "../messaging/messaging.module";

import { AuthService } from "./auth.service";

@Module({
  exports: [AuthService],
  imports: [MessagingModule, LoggerModule, TypeOrmModule.forFeature([ChannelRepository])],
  providers: [AuthService],
})
export class AuthModule {}
