import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AuthModule } from "../auth/auth.module";
import { CFCoreModule } from "../cfCore/cfCore.module";
import { ChannelModule } from "../channel/channel.module";
import { ChannelRepository } from "../channel/channel.repository";
import { AppInstanceRepository } from "../appInstance/appInstance.repository";
import { ConfigModule } from "../config/config.module";
import { LoggerModule } from "../logger/logger.module";
import { MessagingModule } from "../messaging/messaging.module";
import { DepositModule } from "../deposit/deposit.module";

import { SignedTransferService } from "./signedTransfer.service";
import { signedTransferProviderFactory } from "./signedTransfer.provider";
import { SignedTransferRepository } from "./signedTransfer.repository";
@Module({
  controllers: [],
  exports: [SignedTransferService],
  imports: [
    AuthModule,
    CFCoreModule,
    ChannelModule,
    DepositModule,
    ConfigModule,
    LoggerModule,
    MessagingModule,
    TypeOrmModule.forFeature([ChannelRepository, AppInstanceRepository, SignedTransferRepository]),
  ],
  providers: [SignedTransferService, signedTransferProviderFactory],
})
export class SignedTransferModule {}
