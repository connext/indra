import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { CFCoreModule } from "../cfCore/cfCore.module";
import { ConfigModule } from "../config/config.module";
import { LoggerModule } from "../logger/logger.module";
import { OnchainTransactionModule } from "../onchainTransactions/onchainTransaction.module";
import { OnchainTransactionRepository } from "../onchainTransactions/onchainTransaction.repository";
import { ChannelRepository } from "../channel/channel.repository";

import { WithdrawRepository } from "./withdraw.repository";
import { WithdrawService } from "./withdraw.service";

@Module({
  controllers: [],
  exports: [WithdrawService],
  imports: [
    CFCoreModule,
    ConfigModule,
    OnchainTransactionModule,
    LoggerModule,
    TypeOrmModule.forFeature([OnchainTransactionRepository, WithdrawRepository, ChannelRepository]),
  ],
  providers: [WithdrawService],
})
export class WithdrawModule {}
