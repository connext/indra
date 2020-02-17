import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { CFCoreModule } from "../cfCore/cfCore.module";
import { ChannelModule } from "../channel/channel.module";
import { ChannelRepository } from "../channel/channel.repository";
import { ConfigModule } from "../config/config.module";
import { MessagingModule } from "../messaging/messaging.module";
import { SwapRateModule } from "../swapRate/swapRate.module";
import { TransferModule } from "../transfer/transfer.module";
import { LinkedTransferRepository } from "../transfer/transfer.repository";

import { AppRegistryController } from "./appRegistry.controller";
import { appRegistryProviderFactory } from "./appRegistry.provider";
import { AppRegistryRepository } from "./appRegistry.repository";
import { AppRegistryService } from "./appRegistry.service";

@Module({
  controllers: [AppRegistryController],
  exports: [AppRegistryService],
  imports: [
    CFCoreModule,
    ChannelModule,
    ConfigModule,
    MessagingModule,
    SwapRateModule,
    TransferModule,
    TypeOrmModule.forFeature([AppRegistryRepository, ChannelRepository, LinkedTransferRepository]),
  ],
  providers: [appRegistryProviderFactory, AppRegistryService],
})
export class AppRegistryModule {}
