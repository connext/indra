import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AppRegistryRepository } from "../appRegistry/appRegistry.repository";
import { CFCoreModule } from "../cfCore/cfCore.module";
import { ConfigModule } from "../config/config.module";
import { LoggerModule } from "../logger/logger.module";
import { OnchainTransactionModule } from "../onchainTransactions/onchainTransaction.module";
import { OnchainTransactionRepository } from "../onchainTransactions/onchainTransaction.repository";
import { ChannelRepository } from "../channel/channel.repository";

import { DepositService } from "./deposit.service";

@Module({
    controllers: [],
    exports: [DepositService],
    imports: [
      ConfigModule,
      CFCoreModule,
      OnchainTransactionModule,
      LoggerModule,
      TypeOrmModule.forFeature([
        AppRegistryRepository,
        ChannelRepository,
      ]),
    ],
    providers: [DepositService],
})
export class DepositModule {}
