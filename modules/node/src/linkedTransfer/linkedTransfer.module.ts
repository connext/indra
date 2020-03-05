import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AppRegistryRepository } from "../appRegistry/appRegistry.repository";
import { AuthModule } from "../auth/auth.module";
import { CFCoreModule } from "../cfCore/cfCore.module";
import { ChannelModule } from "../channel/channel.module";
import { ChannelRepository } from "../channel/channel.repository";
import { ConfigModule } from "../config/config.module";
import { LoggerModule } from "../logger/logger.module";
import { MessagingModule } from "../messaging/messaging.module";
import { FastSignedTransferRepository } from "../fastSignedTransfer/fastSignedTransfer.repository";

import { LinkedTransferRepository } from "./linkedTransfer.repository";
import { LinkedTransferService } from "./linkedTransfer.service";

@Module({
  controllers: [],
  exports: [LinkedTransferService],
  imports: [
    AuthModule,
    CFCoreModule,
    ChannelModule,
    ConfigModule,
    LoggerModule,
    MessagingModule,
    TypeOrmModule.forFeature([
      ChannelRepository,
      AppRegistryRepository,
      LinkedTransferRepository,
      FastSignedTransferRepository,
    ]),
  ],
  providers: [LinkedTransferService],
})
export class LinkedTransferModule {}
