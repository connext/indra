import { Module } from "@nestjs/common";

import { ConfigModule } from "../config/config.module";
import { ConfigService } from "../config/config.service";
import { MessagingModule } from "../messaging/messaging.module";

import { swapRateProviderFactory } from "./swapRate.provider";

@Module({
  controllers: [],
  exports: [swapRateProviderFactory],
  imports: [MessagingModule, ConfigModule],
  providers: [swapRateProviderFactory],
})
export class SwapRateModule {}
