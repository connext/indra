import { Module } from "@nestjs/common";

import { ConfigService } from "./config.service";

@Module({
  exports: [ConfigService],
  providers: [
    {
      provide: ConfigService,
      // TODO: need to add param here to run locally, how can this be dynamic
      useValue: new ConfigService(),
    },
  ],
})
export class ConfigModule {}
