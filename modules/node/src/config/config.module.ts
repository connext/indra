import { Module } from "@nestjs/common";

import { ConfigService } from "./config.service";

@Module({
  exports: [ConfigService],
  providers: [
    {
      provide: ConfigService,
      useValue: new ConfigService(),
    },
  ],
})
export class ConfigModule {}
