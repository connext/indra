import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AppRegistryRepository } from "../appRegistry/appRegistry.repository";
import { CFCoreModule } from "../cfCore/cfCore.module";
import { ChannelModule } from "../channel/channel.module";
import { ChannelRepository } from "../channel/channel.repository";
import { ConfigModule } from "../config/config.module";
import { LoggerModule } from "../logger/logger.module";
import { MessagingModule } from "../messaging/messaging.module";
import { FastSignedTransferRepository } from "./fastSignedTransfer.repository";
import { TransferRepository } from "../transfer/transfer.repository";
import { AuthModule } from "../auth/auth.module";

import { FastSignedTransferService } from "./fastSignedTransfer.service";
import { fastSignedTransferProviderFactory } from "./fastSignedTransfer.provider";

@Module({
  controllers: [],
  exports: [FastSignedTransferService],
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
      FastSignedTransferRepository,
      TransferRepository,
    ]),
  ],
  providers: [FastSignedTransferService, fastSignedTransferProviderFactory],
})
export class FastSignedTransferModule {}
