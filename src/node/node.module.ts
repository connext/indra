import { forwardRef, Module } from "@nestjs/common";

import { ChannelModule } from "../channel/channel.module";
import { ConfigModule } from "../config/config.module";
import { UserModule } from "../user/user.module";

import { NodeController } from "./node.controller";
import {
  FirebaseProvider,
  NatsProvider,
  NodeProvider,
  PostgresProvider,
} from "./node.provider";

@Module({
  controllers: [NodeController],
  exports: [NodeProvider, FirebaseProvider],
  imports: [ConfigModule, UserModule, forwardRef(() => ChannelModule)],
  providers: [FirebaseProvider, NatsProvider, NodeProvider, PostgresProvider],
})
export class NodeModule {}
