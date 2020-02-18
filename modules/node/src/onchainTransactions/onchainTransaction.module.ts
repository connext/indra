import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { ConfigModule } from "../config/config.module";

import { OnchainTransactionService } from "./onchainTransaction.service";
import { OnchainTransactionRepository } from "./onchainTransaction.repository";

@Module({
  controllers: [],
  exports: [OnchainTransactionService],
  imports: [ConfigModule, TypeOrmModule.forFeature([OnchainTransactionRepository])],
  providers: [OnchainTransactionService],
})
export class OnchainTransactionModule {}
