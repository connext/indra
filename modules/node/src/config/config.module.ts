import { Module } from "@nestjs/common";

import { ConfigController } from "./config.controller";
import { ConfigService } from "./config.service";

@Module({
  controllers: [ConfigController],
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
