import { Module } from "@nestjs/common";

import { ConfigModule } from "../config/config.module";

import { NodeController } from "./node.controller";
import { FirebaseProvider, NodeProvider } from "./node.provider";

@Module({
  providers: [NodeProvider, FirebaseProvider],
  imports: [ConfigModule],
  controllers: [NodeController],
  exports: [NodeProvider, FirebaseProvider],
})
export class NodeModule {}
