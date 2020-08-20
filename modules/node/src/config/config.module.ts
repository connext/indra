import { Module } from "@nestjs/common";

import { ConfigController } from "./config.controller";
import { ConfigService } from "./config.service";
import { LoggerModule } from "../logger/logger.module";

@Module({
  controllers: [ConfigController],
  exports: [ConfigService],
  imports: [LoggerModule],
  providers: [ConfigService],
})
export class ConfigModule {}
