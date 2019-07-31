import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { MessagingModule } from "../messaging/messaging.module";
import { NodeModule } from "../node/node.module";
import { PaymentProfileRepository } from "../paymentProfile/paymentProfile.repository";
import { UserModule } from "../user/user.module";
import { UserRepository } from "../user/user.repository";

import { channelProviderFactory } from "./channel.provider";
import { ChannelRepository } from "./channel.repository";
import { ChannelService } from "./channel.service";

@Module({
  controllers: [],
  exports: [ChannelService],
  imports: [
    MessagingModule,
    NodeModule,
    TypeOrmModule.forFeature([ChannelRepository, UserRepository, PaymentProfileRepository]),
    UserModule,
  ],
  providers: [ChannelService, channelProviderFactory],
})
export class ChannelModule {}
