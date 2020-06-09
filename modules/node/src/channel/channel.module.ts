import { Module, HttpModule } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AppRegistryRepository } from "../appRegistry/appRegistry.repository";
import { AuthModule } from "../auth/auth.module";
import { CFCoreModule } from "../cfCore/cfCore.module";
import { CFCoreRecordRepository } from "../cfCore/cfCore.repository";
import { ConfigModule } from "../config/config.module";
import { LoggerModule } from "../logger/logger.module";
import { MessagingModule } from "../messaging/messaging.module";
import { WithdrawModule } from "../withdraw/withdraw.module";
import { DepositModule } from "../deposit/deposit.module";
import { OnchainTransactionRepository } from "../onchainTransactions/onchainTransaction.repository";
import { RebalanceProfileRepository } from "../rebalanceProfile/rebalanceProfile.repository";

import { channelProviderFactory } from "./channel.provider";
import { ChannelRepository } from "./channel.repository";
import { ChannelService } from "./channel.service";
import { SetupCommitmentRepository } from "../setupCommitment/setupCommitment.repository";
import { SetStateCommitmentRepository } from "../setStateCommitment/setStateCommitment.repository";
import { ConditionalTransactionCommitmentRepository } from "../conditionalCommitment/conditionalCommitment.repository";
import { CacheModule } from "../caching/cache.module";

@Module({
  controllers: [],
  exports: [ChannelService],
  imports: [
    AuthModule,
    CFCoreModule,
    ConfigModule,
    HttpModule,
    WithdrawModule,
    LoggerModule,
    MessagingModule,
    DepositModule,
    CacheModule,
    TypeOrmModule.forFeature([
      AppRegistryRepository,
      ChannelRepository,
      RebalanceProfileRepository,
      CFCoreRecordRepository,
      OnchainTransactionRepository,
      SetupCommitmentRepository,
      SetStateCommitmentRepository,
      ConditionalTransactionCommitmentRepository,
    ]),
  ],
  providers: [ChannelService, channelProviderFactory],
})
export class ChannelModule {}
