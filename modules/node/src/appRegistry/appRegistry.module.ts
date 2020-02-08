import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { CFCoreModule } from "../cfCore/cfCore.module";
import { ChannelModule } from "../channel/channel.module";
import { ChannelRepository } from "../channel/channel.repository";
import { ConfigModule } from "../config/config.module";
import { SwapRateModule } from "../swapRate/swapRate.module";
import { TransferModule } from "../transfer/transfer.module";
import { LinkedTransferRepository } from "../transfer/transfer.repository";

import { AppRegistryController } from "./appRegistry.controller";
import { AppRegistryRepository } from "./appRegistry.repository";
import { AppRegistryService } from "./appRegistry.service";

@Module({
  controllers: [AppRegistryController],
  exports: [AppRegistryService],
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([AppRegistryRepository, ChannelRepository, LinkedTransferRepository]),
    CFCoreModule,
    SwapRateModule,
    ChannelModule,
    TransferModule,
  ],
  providers: [AppRegistryService],
})
export class AppRegistryModule {}
