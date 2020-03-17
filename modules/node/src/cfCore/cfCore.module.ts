import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AppRegistryRepository } from "../appRegistry/appRegistry.repository";
import { ConfigModule } from "../config/config.module";
import { DatabaseModule } from "../database/database.module";
import { LockModule } from "../lock/lock.module";
import { LoggerModule } from "../logger/logger.module";
import { MessagingModule } from "../messaging/messaging.module";
import { ChannelRepository } from "../channel/channel.repository";

import { CFCoreController } from "./cfCore.controller";
import { cfCoreProviderFactory } from "./cfCore.provider";
import { CFCoreRecordRepository } from "./cfCore.repository";
import { CFCoreService } from "./cfCore.service";

@Module({
  controllers: [CFCoreController],
  exports: [cfCoreProviderFactory, CFCoreService],
  imports: [
    ConfigModule,
    DatabaseModule,
    LockModule,
    LoggerModule,
    MessagingModule,
    TypeOrmModule.forFeature([CFCoreRecordRepository, AppRegistryRepository, ChannelRepository]),
  ],
  providers: [cfCoreProviderFactory, CFCoreService],
})
export class CFCoreModule {}
