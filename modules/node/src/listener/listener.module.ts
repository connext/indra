import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AppRegistryModule } from "../appRegistry/appRegistry.module";
import { CFCoreModule } from "../cfCore/cfCore.module";
import { ChannelModule } from "../channel/channel.module";
import { ConfigModule } from "../config/config.module";
import { ChannelRepository } from "../channel/channel.repository";
import { LoggerModule } from "../logger/logger.module";
import { MessagingModule } from "../messaging/messaging.module";
import { TransferModule } from "../transfer/transfer.module";
import { LinkedTransferModule } from "../linkedTransfer/linkedTransfer.module";

import ListenerService from "./listener.service";
import { AppInstanceRepository } from "../appInstance/appInstance.repository";

@Module({
  controllers: [],
  exports: [ListenerService],
  imports: [
    AppRegistryModule,
    CFCoreModule,
    ChannelModule,
    LinkedTransferModule,
    LoggerModule,
    ConfigModule,
    MessagingModule,
    MessagingModule,
    TransferModule,
    TypeOrmModule.forFeature([ChannelRepository, AppInstanceRepository]),
  ],
  providers: [ListenerService],
})
export class ListenerModule {}
