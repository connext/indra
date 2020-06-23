import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AuthModule } from "../auth/auth.module";
import { CFCoreModule } from "../cfCore/cfCore.module";
import { ChannelModule } from "../channel/channel.module";
import { ChannelRepository } from "../channel/channel.repository";
import { ConfigModule } from "../config/config.module";
import { LoggerModule } from "../logger/logger.module";
import { MessagingModule } from "../messaging/messaging.module";
import { DepositModule } from "../deposit/deposit.module";

import { HashLockTransferService } from "./hashLockTransfer.service";
import { hashLockTransferProviderFactory } from "./hashLockTransfer.provider";
import { HashlockTransferRepository } from "./hashlockTransfer.repository";

@Module({
  controllers: [],
  exports: [HashLockTransferService],
  imports: [
    AuthModule,
    CFCoreModule,
    ChannelModule,
    DepositModule,
    ConfigModule,
    LoggerModule,
    MessagingModule,
    TypeOrmModule.forFeature([ChannelRepository, HashlockTransferRepository]),
  ],
  providers: [HashLockTransferService, hashLockTransferProviderFactory],
})
export class HashLockTransferModule {}
