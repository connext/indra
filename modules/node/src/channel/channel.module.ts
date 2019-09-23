import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { CFCoreModule } from "../cfCore/cfCore.module";
import { CFCoreRecordRepository } from "../cfCore/cfCore.repository";
import { ConfigModule } from "../config/config.module";
import { MessagingModule } from "../messaging/messaging.module";
import { PaymentProfileRepository } from "../paymentProfile/paymentProfile.repository";

import { channelProviderFactory } from "./channel.provider";
import { ChannelRepository } from "./channel.repository";
import { ChannelService } from "./channel.service";

@Module({
  controllers: [],
  exports: [ChannelService],
  imports: [
    MessagingModule,
    CFCoreModule,
    TypeOrmModule.forFeature([ChannelRepository, PaymentProfileRepository, CFCoreRecordRepository]),
    ConfigModule,
  ],
  providers: [ChannelService, channelProviderFactory],
})
export class ChannelModule {}
