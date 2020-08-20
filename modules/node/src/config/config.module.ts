import { Module } from "@nestjs/common";
import { LoggerModule } from "nestjs-pino";

import { ConfigController } from "./config.controller";
import { ConfigService } from "./config.service";

@Module({
  controllers: [ConfigController],
  exports: [ConfigService],
  imports: [LoggerModule.forRoot()],
  providers: [ConfigService],
})
export class ConfigModule {}
