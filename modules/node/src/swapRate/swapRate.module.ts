import { Module } from "@nestjs/common";

import { ConfigModule } from "../config/config.module";
import { LoggerModule } from "../logger/logger.module";
import { MessagingModule } from "../messaging/messaging.module";

import { swapRateProviderFactory } from "./swapRate.provider";
import { SwapRateService } from "./swapRate.service";

@Module({
  controllers: [],
  exports: [swapRateProviderFactory, SwapRateService],
  imports: [ConfigModule, LoggerModule, MessagingModule],
  providers: [swapRateProviderFactory, SwapRateService],
})
export class SwapRateModule {}
