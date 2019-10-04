import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { ConfigModule } from "../config/config.module";
import { DatabaseModule } from "../database/database.module";
import { LockModule } from "../lock/lock.module";
import { MessagingModule } from "../messaging/messaging.module";

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
    MessagingModule,
    TypeOrmModule.forFeature([CFCoreRecordRepository]),
    LockModule,
  ],
  providers: [cfCoreProviderFactory, CFCoreService],
})
export class CFCoreModule {}
