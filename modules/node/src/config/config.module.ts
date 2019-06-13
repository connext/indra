import { Module } from "@nestjs/common";

import { ConfigService } from "./config.service";

@Module({
  exports: [ConfigService],
  providers: [
    {
      provide: ConfigService,
      useValue: new ConfigService(/*'.env'*/),
    },
  ],
})
export class ConfigModule {}
