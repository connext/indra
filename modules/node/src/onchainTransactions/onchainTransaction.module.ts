import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { ConfigModule } from "../config/config.module";

import { OnchainTransactionService } from "./onchainTransaction.service";
import { OnchainTransactionRepository } from "./onchainTransaction.repository";
import { ChannelRepository } from "../channel/channel.repository";
import { LoggerModule } from "nestjs-pino";

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
