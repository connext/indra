import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { ChannelRepository } from "../channel/channel.repository";
import { MessagingModule } from "../messaging/messaging.module";

import { authProviderFactory } from "./auth.provider";
import { AuthService } from "./auth.service";

@Module({
  exports: [AuthService, authProviderFactory],
  imports: [MessagingModule, TypeOrmModule.forFeature([ChannelRepository])],
  providers: [AuthService, authProviderFactory],
})
export class AuthModule {}
