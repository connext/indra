import { Module } from "@nestjs/common";

import { NatsModule } from "../nats/nats.module";

import { exchangeRateProvider } from "./exchangeRate.provider";
import { ExchangeRateService } from "./exchangeRate.service";

@Module({
  exports: [exchangeRateProvider, ExchangeRateService],
  imports: [NatsModule],
  providers: [exchangeRateProvider, ExchangeRateService],
})
export class ExchangeRateModule {}
