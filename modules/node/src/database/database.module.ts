import { Module } from "@nestjs/common";

import { ConfigModule } from "../config/config.module";

import { databaseProvider } from "./database.provider";

@Module({
  exports: [databaseProvider],
  imports: [ConfigModule],
  providers: [databaseProvider],
})
export class DatabaseModule {}
