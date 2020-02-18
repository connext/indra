import { Module, HttpModule } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AuthModule } from "../auth/auth.module";
import { CFCoreModule } from "../cfCore/cfCore.module";
import { CFCoreRecordRepository } from "../cfCore/cfCore.repository";
import { ConfigModule } from "../config/config.module";
import { MessagingModule } from "../messaging/messaging.module";
import { OnchainTransactionModule } from "../onchainTransactions/onchainTransaction.module";
import { OnchainTransactionRepository } from "../onchainTransactions/onchainTransaction.repository";
import { RebalanceProfileRepository } from "../rebalanceProfile/rebalanceProfile.repository";

import { channelProviderFactory } from "./channel.provider";
import { ChannelRepository } from "./channel.repository";
import { ChannelService } from "./channel.service";

@Module({
  controllers: [],
  exports: [ChannelService],
  imports: [
    MessagingModule,
    CFCoreModule,
    TypeOrmModule.forFeature([
      ChannelRepository,
      RebalanceProfileRepository,
      CFCoreRecordRepository,
      OnchainTransactionRepository,
    ]),
    ConfigModule,
    AuthModule,
    HttpModule,
    OnchainTransactionModule,
  ],
  providers: [ChannelService, channelProviderFactory],
})
export class ChannelModule {}
