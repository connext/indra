import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ChallengeService } from "./challenge.service";
import { LoggerModule } from "../logger/logger.module";
import { ChannelModule } from "../channel/channel.module";
import { ConfigModule } from "../config/config.module";
import { OnchainTransactionModule } from "../onchainTransactions/onchainTransaction.module";
import { AppInstanceRepository } from "../appInstance/appInstance.repository";
import { ChannelRepository } from "../channel/channel.repository";
import { AuthModule } from "../auth/auth.module";
import { challengeProviderFactory } from "./challenge.provider";

@Module({
  exports: [ChallengeService],
  imports: [
    AuthModule,
    ChannelModule,
    ConfigModule,
    OnchainTransactionModule,
    LoggerModule,
    TypeOrmModule.forFeature([AppInstanceRepository, ChannelRepository]),
  ],
  providers: [ChallengeService, challengeProviderFactory],
})
export class ChallengeModule {}
