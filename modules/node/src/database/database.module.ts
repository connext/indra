import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { ConfigModule } from "../config/config.module";
import { ConfigService } from "../config/config.service";

import { TypeOrmConfigService } from "./database.service";
import { LoggerModule } from "nestjs-pino";

@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useClass: TypeOrmConfigService,
    }),
  ],
})
export class DatabaseModule {}
