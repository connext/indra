import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AppRegistryModule } from "../appRegistry/appRegistry.module";
import { AppRegistryRepository } from "../appRegistry/appRegistry.repository";
import { ChannelRepository } from "../channel/channel.repository";
import { ConfigModule } from "../config/config.module";
import { MessagingModule } from "../messaging/messaging.module";
import { NodeModule } from "../node/node.module";

import { transferProviderFactory } from "./transfer.provider";
import { TransferService } from "./transfer.service";

@Module({
  controllers: [],
  exports: [TransferService],
  imports: [
    ConfigModule,
    NodeModule,
    TypeOrmModule.forFeature([ChannelRepository, AppRegistryRepository]),
    AppRegistryModule,
    MessagingModule,
  ],
  providers: [TransferService, transferProviderFactory],
})
export class TransferModule {}
