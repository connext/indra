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
import { MessagingModule } from "../messaging/messaging.module";
import { AppInstanceRepository } from "../appInstance/appInstance.repository";
import { WithdrawRepository } from "../withdraw/withdraw.repository";
import { SignedTransferModule } from "../signedTransfer/signedTransfer.module";
import { HashLockTransferModule } from "../hashLockTransfer/hashLockTransfer.module";

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
    HashLockTransferModule,
    LinkedTransferModule,
    LoggerModule,
    LinkedTransferModule,
    SignedTransferModule,
    SwapRateModule,
    MessagingModule,
    TransferModule,
    TypeOrmModule.forFeature([
      AppInstanceRepository,
      AppRegistryRepository,
      ChannelRepository,
      WithdrawRepository,
    ]),
    WithdrawModule,
  ],
  providers: [AppRegistryService, AppActionsService],
})
export class AppRegistryModule {}
