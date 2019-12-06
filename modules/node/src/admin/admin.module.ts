import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { CFCoreModule } from "../cfCore/cfCore.module";
import { ChannelModule } from "../channel/channel.module";
import { MessagingModule } from "../messaging/messaging.module";
import { TransferModule } from "../transfer/transfer.module";

import { adminProviderFactory } from "./admin.provider";
import { AdminService } from "./admin.service";

@Module({
  controllers: [],
  exports: [AdminService],
  imports: [MessagingModule, CFCoreModule, ChannelModule, AuthModule, TransferModule],
  providers: [AdminService, adminProviderFactory],
})
export class AdminModule {}
