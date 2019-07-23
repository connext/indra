import { Module } from "@nestjs/common";

import { ConfigModule } from "../config/config.module";
import { MessagingModule } from "../messaging/messaging.module";

import { swapRateProvider } from "./swapRate.provider";
import { SwapRateService } from "./swapRate.service";

@Module({
  exports: [swapRateProvider, SwapRateService],
  imports: [ConfigModule, MessagingModule],
  providers: [swapRateProvider, SwapRateService],
})
export class SwapRateModule {}
