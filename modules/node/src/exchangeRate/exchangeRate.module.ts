import { Module } from "@nestjs/common";

import { NatsModule } from "../nats/nats.module";

@Module({
  exports: [],
  imports: [NatsModule],
  providers: [],
})
export class ExchangeRateModule {}
