import { Injectable, Module } from "@nestjs/common";
import { TypeOrmModule, TypeOrmOptionsFactory, TypeOrmModuleOptions } from "@nestjs/typeorm";

import { entities } from "../database/database.service";

@Injectable()
export class TypeOrmConfigService implements TypeOrmOptionsFactory {
  constructor() {}
  createTypeOrmOptions(): TypeOrmModuleOptions {
    return {
      database: ":memory:",
      entities,
      logging: ["error"],
      synchronize: true,
      type: "sqlite",
    };
  }
}

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [],
      inject: [],
      useClass: TypeOrmConfigService,
    }),
  ],
})
export class MemoryDatabaseModule {}
