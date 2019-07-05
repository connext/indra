import { Module } from "@nestjs/common";

import { ConfigModule } from "../config/config.module";

import { natsClient } from "./nats.provider";

@Module({
  exports: [natsClient],
  imports: [ConfigModule],
  providers: [natsClient],
})
export class NatsModule {}
