import { Module } from "@nestjs/common";

import { ConfigModule } from "../config/config.module";
import { MessagingModule } from "../messaging/messaging.module";

import { swapRateProviderFactory } from "./swapRate.provider";
import { SwapRateService } from "./swapRate.service";
import { LoggerModule } from "nestjs-pino";

@Module({
  controllers: [],
  exports: [swapRateProviderFactory, SwapRateService],
  imports: [ConfigModule, MessagingModule, LoggerModule],
  providers: [swapRateProviderFactory, SwapRateService],
})
export class SwapRateModule {}
