import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { CFCoreModule } from "../cfCore/cfCore.module";
import { ChannelModule } from "../channel/channel.module";
import { ChannelRepository } from "../channel/channel.repository";
import { ConfigModule } from "../config/config.module";
import { LoggerModule } from "../logger/logger.module";
import { WithdrawModule } from "../withdraw/withdraw.module";
import { SwapRateModule } from "../swapRate/swapRate.module";
import { TransferModule } from "../transfer/transfer.module";
import { LinkedTransferModule } from "../linkedTransfer/linkedTransfer.module";
import { FastSignedTransferModule } from "../fastSignedTransfer/fastSignedTransfer.module";
import { MessagingModule } from "../messaging/messaging.module";
import { AppInstanceRepository } from "../appInstance/appInstance.repository";
import { WithdrawRepository } from "../withdraw/withdraw.repository";

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
    FastSignedTransferModule,
    LinkedTransferModule,
    LoggerModule,
    SwapRateModule,
    LinkedTransferModule,
    TransferModule,
    MessagingModule,
    WithdrawModule,
    TypeOrmModule.forFeature([
      AppInstanceRepository,
      AppRegistryRepository,
      ChannelRepository,
      WithdrawRepository,
    ]),
  ],
  providers: [AppRegistryService, AppActionsService],
})
export class AppRegistryModule {}
