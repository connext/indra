import { Module } from "@nestjs/common";

import { ConfigModule } from "../config/config.module";
import { MessagingModule } from "../messaging/messaging.module";

import { NodeController } from "./node.controller";
import { nodeProviderFactory, postgresProviderFactory } from "./node.provider";
import { NodeService } from "./node.service";

@Module({
  controllers: [NodeController],
  exports: [nodeProviderFactory, NodeService],
  imports: [ConfigModule, MessagingModule],
  providers: [nodeProviderFactory, postgresProviderFactory, NodeService],
})
export class NodeModule {}
