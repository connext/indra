import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { LoggerModule } from "../logger/logger.module";
import { ConfigModule } from "../config/config.module";

import { OnchainTransactionService } from "./onchainTransaction.service";
import { OnchainTransactionRepository } from "./onchainTransaction.repository";
import { ChannelRepository } from "../channel/channel.repository";

@Module({
  controllers: [],
  exports: [OnchainTransactionService],
  imports: [
    ConfigModule,
    LoggerModule,
    TypeOrmModule.forFeature([OnchainTransactionRepository, ChannelRepository]),
  ],
  providers: [OnchainTransactionService],
})
export class OnchainTransactionModule {}
