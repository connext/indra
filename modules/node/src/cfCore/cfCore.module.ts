import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AppInstanceRepository } from "../appInstance/appInstance.repository";
import { AppRegistryRepository } from "../appRegistry/appRegistry.repository";
import { ChannelRepository } from "../channel/channel.repository";
import {
  ConditionalTransactionCommitmentRepository,
  SetStateCommitmentRepository,
  WithdrawCommitmentRepository,
} from "../commitment/commitment.repository";
import { ConfigModule } from "../config/config.module";
import { DatabaseModule } from "../database/database.module";
import { LockModule } from "../lock/lock.module";
import { LoggerModule } from "../logger/logger.module";
import { MessagingModule } from "../messaging/messaging.module";

import { CFCoreController } from "./cfCore.controller";
import { cfCoreProviderFactory } from "./cfCore.provider";
import { CFCoreRecordRepository } from "./cfCore.repository";
import { CFCoreService } from "./cfCore.service";
import { CFCoreStore } from "./cfCore.store";

@Module({
  controllers: [CFCoreController],
  exports: [cfCoreProviderFactory, CFCoreService],
  imports: [
    ConfigModule,
    DatabaseModule,
    LockModule,
    LoggerModule,
    MessagingModule,
    TypeOrmModule.forFeature([
      CFCoreRecordRepository,
      AppRegistryRepository,
      ChannelRepository,
      AppInstanceRepository,
      ConditionalTransactionCommitmentRepository,
      SetStateCommitmentRepository,
      WithdrawCommitmentRepository,
    ]),
  ],
  providers: [cfCoreProviderFactory, CFCoreService, CFCoreStore],
})
export class CFCoreModule {}
