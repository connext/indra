import { Module } from "@nestjs/common";

import { ConfigModule } from "../config/config.module";
import { UserModule } from "../user/user.module";

import { NodeController } from "./node.controller";
import { messagingProvider, nodeProvider, postgresProvider } from "./node.provider";

@Module({
  controllers: [NodeController],
  exports: [nodeProvider, messagingProvider],
  imports: [ConfigModule, UserModule],
  providers: [messagingProvider, nodeProvider, postgresProvider],
})
export class NodeModule {}
