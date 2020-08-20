import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AuthModule } from "../auth/auth.module";
import { CFCoreModule } from "../cfCore/cfCore.module";
import { ChannelModule } from "../channel/channel.module";
import { ChannelRepository } from "../channel/channel.repository";
import { ConfigModule } from "../config/config.module";
import { MessagingModule } from "../messaging/messaging.module";
import { LinkedTransferModule } from "../linkedTransfer/linkedTransfer.module";
import { DepositModule } from "../deposit/deposit.module";
import { SwapRateModule } from "../swapRate/swapRate.module";

import { transferProviderFactory } from "./transfer.provider";
import { TransferService } from "./transfer.service";
import { TransferRepository } from "./transfer.repository";
import { LoggerModule } from "nestjs-pino";

@Module({
  controllers: [],
  exports: [TransferService],
  imports: [
    AuthModule,
    CFCoreModule,
    ChannelModule,
    ConfigModule,
    DepositModule,
    LinkedTransferModule,
    LoggerModule,
    MessagingModule,
    SwapRateModule,
    TypeOrmModule.forFeature([ChannelRepository, TransferRepository]),
  ],
  providers: [TransferService, transferProviderFactory],
})
export class TransferModule {}
