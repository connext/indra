import { Module } from "@nestjs/common";

import { NatsModule } from "../nats/nats.module";

import { swapRateProvider } from "./swapRate.provider";
import { SwapRateService } from "./swapRate.service";

@Module({
  exports: [swapRateProvider, SwapRateService],
  imports: [NatsModule],
  providers: [swapRateProvider, SwapRateService],
})
export class SwapRateModule {}
