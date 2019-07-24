import { Module } from "@nestjs/common";

import { ConfigModule } from "../config/config.module";
import { MessagingModule } from "../messaging/messaging.module";
import { UserModule } from "../user/user.module";

import { NodeController } from "./node.controller";
import { nodeProviderFactory, postgresProviderFactory } from "./node.provider";

@Module({
  controllers: [NodeController],
  exports: [nodeProviderFactory],
  imports: [ConfigModule, MessagingModule, UserModule],
  providers: [nodeProviderFactory, postgresProviderFactory],
})
export class NodeModule {}
