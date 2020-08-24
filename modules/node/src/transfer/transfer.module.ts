import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AuthModule } from "../auth/auth.module";
import { CFCoreModule } from "../cfCore/cfCore.module";
import { ChannelModule } from "../channel/channel.module";
import { ChannelRepository } from "../channel/channel.repository";
import { ConfigModule } from "../config/config.module";
import { LoggerModule } from "../logger/logger.module";
import { MessagingModule } from "../messaging/messaging.module";
import { LinkedTransferModule } from "../linkedTransfer/linkedTransfer.module";
import { DepositModule } from "../deposit/deposit.module";
import { SwapRateModule } from "../swapRate/swapRate.module";
import { AppInstanceRepository } from "../appInstance/appInstance.repository";

import { transferProviderFactory } from "./transfer.provider";
import { TransferService } from "./transfer.service";
import { TransferRepository } from "./transfer.repository";

@Module({
  controllers: [],
  exports: [TransferService],
  imports: [
    AuthModule,
    CFCoreModule,
    ChannelModule,
    ConfigModule,
    DepositModule,
    LoggerModule,
    LinkedTransferModule,
    MessagingModule,
    SwapRateModule,
    TypeOrmModule.forFeature([ChannelRepository, TransferRepository, AppInstanceRepository]),
  ],
  providers: [TransferService, transferProviderFactory],
})
export class TransferModule {}
