import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AppRegistryModule } from "../appRegistry/appRegistry.module";
import { ChannelModule } from "../channel/channel.module";
import { NodeModule } from "../node/node.module";
import { TransferModule } from "../transfer/transfer.module";
import { LinkedTransferRepository } from "../transfer/transfer.repository";

import ListenerService from "./listener.service";

@Module({
  controllers: [],
  exports: [ListenerService],
  imports: [
    NodeModule,
    AppRegistryModule,
    ChannelModule,
    TransferModule,
    TypeOrmModule.forFeature([LinkedTransferRepository]),
  ],
  providers: [ListenerService],
})
export class ListenerModule {}
