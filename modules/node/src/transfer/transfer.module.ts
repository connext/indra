import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AppRegistryRepository } from "../appRegistry/appRegistry.repository";
import { ChannelRepository } from "../channel/channel.repository";
import { ConfigModule } from "../config/config.module";
import { MessagingModule } from "../messaging/messaging.module";
import { NodeModule } from "../node/node.module";

import { transferProviderFactory } from "./transfer.provider";
import { LinkedTransferRepository, PeerToPeerTransferRepository } from "./transfer.repository";
import { TransferService } from "./transfer.service";

@Module({
  controllers: [],
  exports: [TransferService],
  imports: [
    ConfigModule,
    NodeModule,
    TypeOrmModule.forFeature([
      ChannelRepository,
      AppRegistryRepository,
      LinkedTransferRepository,
      PeerToPeerTransferRepository,
    ]),
    MessagingModule,
  ],
  providers: [TransferService, transferProviderFactory],
})
export class TransferModule {}
