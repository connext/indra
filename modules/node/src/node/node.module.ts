import { Module } from "@nestjs/common";

import { ConfigModule } from "../config/config.module";
import { UserModule } from "../user/user.module";

import { NodeController } from "./node.controller";
import { natsProvider, nodeProvider, postgresProvider } from "./node.provider";

@Module({
  controllers: [NodeController],
  exports: [nodeProvider],
  imports: [ConfigModule, UserModule],
  providers: [natsProvider, nodeProvider, postgresProvider],
})
export class NodeModule {}
