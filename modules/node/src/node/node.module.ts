import { forwardRef, Module } from "@nestjs/common";

import { ChannelModule } from "../channel/channel.module";
import { ConfigModule } from "../config/config.module";
import { UserModule } from "../user/user.module";

import { NodeController } from "./node.controller";
import { NatsProvider, NodeProvider, PostgresProvider } from "./node.provider";

@Module({
  controllers: [NodeController],
  exports: [NodeProvider],
  imports: [ConfigModule, UserModule, forwardRef(() => ChannelModule)],
  providers: [NatsProvider, NodeProvider, PostgresProvider],
})
export class NodeModule {}
