import { Module } from "@nestjs/common";

import { ConfigModule } from "../config/config.module";

import { NodeController } from "./node.controller";
import { NodeProvider } from "./node.provider";

@Module({
  providers: [NodeProvider],
  imports: [ConfigModule],
  controllers: [NodeController],
  exports: [NodeProvider]
})
export class NodeModule {}
