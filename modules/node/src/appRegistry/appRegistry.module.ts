import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { ChannelModule } from "../channel/channel.module";
import { ChannelRepository } from "../channel/channel.repository";
import { ConfigModule } from "../config/config.module";
import { NodeModule } from "../node/node.module";
import { SwapRateModule } from "../swapRate/swapRate.module";

import { AppRegistryController } from "./appRegistry.controller";
import { appRegistryProviderFactory } from "./appRegistry.provider";
import { AppRegistryRepository } from "./appRegistry.repository";
import { AppRegistryService } from "./appRegistry.service";

@Module({
  controllers: [AppRegistryController],
  exports: [],
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([AppRegistryRepository, ChannelRepository]),
    NodeModule,
    SwapRateModule,
    ChannelModule,
  ],
  providers: [appRegistryProviderFactory, AppRegistryService],
})
export class AppRegistryModule {}
