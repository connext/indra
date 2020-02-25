import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AppRegistryModule } from "../appRegistry/appRegistry.module";
import { CFCoreModule } from "../cfCore/cfCore.module";
import { ChannelModule } from "../channel/channel.module";
import { ChannelRepository } from "../channel/channel.repository";
import { LoggerModule } from "../logger/logger.module";
import { MessagingModule } from "../messaging/messaging.module";
import { TransferModule } from "../transfer/transfer.module";
import { LinkedTransferRepository } from "../transfer/transfer.repository";

import ListenerService from "./listener.service";

@Module({
  controllers: [],
  exports: [ListenerService],
  imports: [
    AppRegistryModule,
    CFCoreModule,
    ChannelModule,
    LoggerModule,
    MessagingModule,
    MessagingModule,
    TransferModule,
    TypeOrmModule.forFeature([LinkedTransferRepository, ChannelRepository]),
  ],
  providers: [ListenerService],
})
export class ListenerModule {}
