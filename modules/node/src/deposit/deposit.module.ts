import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { CFCoreModule } from "../cfCore/cfCore.module";
import { ConfigModule } from "../config/config.module";
import { OnchainTransactionModule } from "../onchainTransactions/onchainTransaction.module";
import { AppInstanceRepository } from "../appInstance/appInstance.repository";

import { DepositService } from "./deposit.service";
import { LoggerModule } from "nestjs-pino";

@Module({
  controllers: [],
  exports: [DepositService],
  imports: [
    ConfigModule,
    CFCoreModule,
    OnchainTransactionModule,
    LoggerModule,
    TypeOrmModule.forFeature([AppInstanceRepository]),
  ],
  providers: [DepositService],
})
export class DepositModule {}
