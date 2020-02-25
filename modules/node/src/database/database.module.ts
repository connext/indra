import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { ConfigModule } from "../config/config.module";
import { ConfigService } from "../config/config.service";
import { LoggerModule } from "../logger/logger.module";
import { LoggerService } from "../logger/logger.service";

import { TypeOrmConfigService } from "./database.service";

@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule, LoggerModule],
      inject: [ConfigService, LoggerService],
      useClass: TypeOrmConfigService,
    }),
  ],
})
export class DatabaseModule {}
