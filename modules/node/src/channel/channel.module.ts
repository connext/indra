import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { ConfigModule } from "../config/config.module";
import { MessagingModule } from "../messaging/messaging.module";
import { NodeModule } from "../node/node.module";
import { PaymentProfileRepository } from "../paymentProfile/paymentProfile.repository";

import { channelProviderFactory } from "./channel.provider";
import { ChannelRepository } from "./channel.repository";
import { ChannelService } from "./channel.service";

@Module({
  controllers: [],
  exports: [ChannelService],
  imports: [
    MessagingModule,
    NodeModule,
    TypeOrmModule.forFeature([ChannelRepository, PaymentProfileRepository]),
    ConfigModule,
  ],
  providers: [ChannelService, channelProviderFactory],
})
export class ChannelModule {}
