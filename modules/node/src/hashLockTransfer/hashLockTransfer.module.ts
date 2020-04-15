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

import { HashLockTransferService } from "./hashLockTransfer.service";
import { hashLockTransferProviderFactory } from "./hashLockTransfer.provider";

@Module({
  controllers: [],
  exports: [HashLockTransferService],
  imports: [
    AuthModule,
    CFCoreModule,
    ChannelModule,
    ConfigModule,
    LoggerModule,
    MessagingModule,
    TypeOrmModule.forFeature([ChannelRepository, AppInstanceRepository]),
  ],
  providers: [HashLockTransferService, hashLockTransferProviderFactory],
})
export class HashLockTransferModule {}
