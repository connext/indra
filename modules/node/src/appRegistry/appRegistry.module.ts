import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { CFCoreModule } from "../cfCore/cfCore.module";
import { ChannelModule } from "../channel/channel.module";
import { ChannelRepository } from "../channel/channel.repository";
import { ConfigModule } from "../config/config.module";
import { LoggerModule } from "../logger/logger.module";
import { WithdrawModule } from "../withdraw/withdraw.module";
import { WithdrawRepository } from "../withdraw/withdraw.repository";
import { SwapRateModule } from "../swapRate/swapRate.module";
import { TransferModule } from "../transfer/transfer.module";
import { LinkedTransferRepository } from "../linkedTransfer/linkedTransfer.repository";
import { LinkedTransferModule } from "../linkedTransfer/linkedTransfer.module";
import { FastSignedTransferRepository } from "../fastSignedTransfer/fastSignedTransfer.repository";
import { MessagingModule } from "../messaging/messaging.module"

import { AppRegistryController } from "./appRegistry.controller";
import { AppRegistryRepository } from "./appRegistry.repository";
import { AppRegistryService } from "./appRegistry.service";
import { AppActionsService } from "./appActions.service";

@Module({
  controllers: [AppRegistryController],
  exports: [AppRegistryService, AppActionsService],
  imports: [
    CFCoreModule,
    ChannelModule,
    ConfigModule,
    LoggerModule,
    SwapRateModule,
    LinkedTransferModule,
    TransferModule,
    WithdrawModule,
    TypeOrmModule.forFeature([
      AppRegistryRepository,
      ChannelRepository,
      LinkedTransferRepository,
      FastSignedTransferRepository,
      WithdrawRepository,
    ]),
    MessagingModule,
  ],
  providers: [AppRegistryService, AppActionsService],
})
export class AppRegistryModule {}
