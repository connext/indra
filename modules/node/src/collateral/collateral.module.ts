import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { CFCoreModule } from "../cfCore/cfCore.module";
import { ConfigModule } from "../config/config.module";
import { LoggerModule } from "../logger/logger.module";
import { AnonymizedOnchainTransactionRepository } from "../onchainTransactions/onchainTransaction.repository";
import { AnonymizedTransferRepository } from "../transfer/anonymizedTransfer.repository";

import { CollateralService } from "./collateral.service";
import { CollateralController } from "./collateral.controller";

@Module({
  controllers: [CollateralController],
  exports: [CollateralService],
  imports: [
    ConfigModule,
    CFCoreModule,
    LoggerModule,
    TypeOrmModule.forFeature([
      AnonymizedOnchainTransactionRepository,
      AnonymizedTransferRepository,
    ]),
  ],
  providers: [CollateralService],
})
export class CollateralModule {}
