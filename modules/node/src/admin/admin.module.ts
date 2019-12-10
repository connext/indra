import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AuthModule } from "../auth/auth.module";
import { CFCoreModule } from "../cfCore/cfCore.module";
import { CFCoreRecordRepository } from "../cfCore/cfCore.repository";
import { ChannelModule } from "../channel/channel.module";
import { ConfigModule } from "../config/config.module";
import { MessagingModule } from "../messaging/messaging.module";
import { TransferModule } from "../transfer/transfer.module";

import { adminProviderFactory } from "./admin.provider";
import { AdminService } from "./admin.service";

@Module({
  controllers: [],
  exports: [AdminService],
  imports: [
    MessagingModule,
    CFCoreModule,
    ChannelModule,
    AuthModule,
    TransferModule,
    ConfigModule,
    TypeOrmModule.forFeature([CFCoreRecordRepository]),
  ],
  providers: [AdminService, adminProviderFactory],
})
export class AdminModule {}
