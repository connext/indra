import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { ConfigModule } from "../config/config.module";
import { NodeModule } from "../node/node.module";

import { AppRegistryController } from "./appRegistry.controller";
import { appRegistryProviderFactory } from "./appRegistry.provider";
import { AppRegistryRepository } from "./appRegistry.repository";
import { AppRegistryService } from "./appRegistry.service";

@Module({
  controllers: [AppRegistryController],
  exports: [],
  imports: [ConfigModule, TypeOrmModule.forFeature([AppRegistryRepository]), NodeModule],
  providers: [appRegistryProviderFactory, AppRegistryService],
})
export class AppRegistryModule {}
