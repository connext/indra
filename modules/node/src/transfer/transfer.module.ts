import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AppRegistryModule } from "../appRegistry/appRegistry.module";
import { AppRegistryRepository } from "../appRegistry/appRegistry.repository";
import { ChannelRepository } from "../channel/channel.repository";
import { ChannelService } from "../channel/channel.service";
import { ConfigModule } from "../config/config.module";
import { NodeModule } from "../node/node.module";

import { TransferService } from "./transfer.service";

@Module({
  controllers: [],
  exports: [TransferService],
  imports: [
    ConfigModule,
    NodeModule,
    TypeOrmModule.forFeature([ChannelRepository, AppRegistryRepository]),
    AppRegistryModule,
  ],
  providers: [ChannelService],
})
export class ChannelModule {}
