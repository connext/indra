import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AuthModule } from "../auth/auth.module";
import { CFCoreModule } from "../cfCore/cfCore.module";
import { CFCoreRecordRepository } from "../cfCore/cfCore.repository";
import { ChannelModule } from "../channel/channel.module";
import { ConfigModule } from "../config/config.module";
import { LoggerModule } from "../logger/logger.module";
import { MessagingModule } from "../messaging/messaging.module";
import { TransferModule } from "../transfer/transfer.module";
import { LinkedTransferRepository } from "../linkedTransfer/linkedTransfer.repository";
import { ChannelRepository } from "../channel/channel.repository";

import { adminProviderFactory } from "./admin.provider";
import { AdminService } from "./admin.service";

@Module({
  controllers: [],
  exports: [AdminService],
  imports: [
    AuthModule,
    CFCoreModule,
    ChannelModule,
    ConfigModule,
    LoggerModule,
    MessagingModule,
    TransferModule,
    TypeOrmModule.forFeature([CFCoreRecordRepository, LinkedTransferRepository, ChannelRepository]),
  ],
  providers: [AdminService, adminProviderFactory],
})
export class AdminModule {}
