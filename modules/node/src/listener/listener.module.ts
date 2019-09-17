import { Module } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AppRegistryModule } from "../appRegistry/appRegistry.module";
import { CFCoreModule } from "../cfCore/cfCore.module";
import { ChannelModule } from "../channel/channel.module";
import { MessagingModule } from "../messaging/messaging.module";
import { LinkedTransferRepository } from "../transfer/transfer.repository";

import ListenerService from "./listener.service";

@Module({
  controllers: [],
  exports: [ListenerService],
  imports: [
    CFCoreModule,
    AppRegistryModule,
    ChannelModule,
    MessagingModule,
    TypeOrmModule.forFeature([LinkedTransferRepository]),
    MessagingModule,
  ],
  providers: [ListenerService],
})
export class ListenerModule {}
