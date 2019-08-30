import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { ConfigModule } from "../config/config.module";
import { DatabaseModule } from "../database/database.module";
import { MessagingModule } from "../messaging/messaging.module";

import { NodeController } from "./node.controller";
import { nodeProviderFactory } from "./node.provider";
import { NodeRecordRepository } from "./node.repository";
import { NodeService } from "./node.service";

@Module({
  controllers: [NodeController],
  exports: [nodeProviderFactory, NodeService],
  imports: [
    ConfigModule,
    DatabaseModule,
    MessagingModule,
    TypeOrmModule.forFeature([NodeRecordRepository]),
  ],
  providers: [nodeProviderFactory, NodeService],
})
export class NodeModule {}
