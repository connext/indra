import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { CFCoreModule } from "../cfCore/cfCore.module";
import { ConfigModule } from "../config/config.module";
import { AnonymizedOnchainTransactionRepository } from "../onchainTransactions/onchainTransaction.repository";

import { CollateralService } from "./collateral.service";
import { CollateralController } from "./collateral.controller";

@Module({
  controllers: [CollateralController],
  exports: [CollateralService],
  imports: [
    ConfigModule,
    CFCoreModule,
    TypeOrmModule.forFeature([AnonymizedOnchainTransactionRepository]),
  ],
  providers: [CollateralService],
})
export class CollateralModule {}
