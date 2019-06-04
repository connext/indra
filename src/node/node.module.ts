import { forwardRef, Module } from "@nestjs/common";

import { ChannelModule } from "../channel/channel.module";
import { ConfigModule } from "../config/config.module";
import { UserModule } from "../user/user.module";

import { NodeController } from "./node.controller";
import { FirebaseProvider, NodeProvider } from "./node.provider";

@Module({
  providers: [NodeProvider, FirebaseProvider],
  imports: [ConfigModule, UserModule, forwardRef(() => ChannelModule)],
  controllers: [NodeController],
  exports: [NodeProvider, FirebaseProvider],
})
export class NodeModule {}
