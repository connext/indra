import { forwardRef, Module } from "@nestjs/common";

import { ChannelModule } from "../channel/channel.module";
import { ConfigModule } from "../config/config.module";
import { UserModule } from "../user/user.module";

import { NodeController } from "./node.controller";
import { natsProvider, nodeProvider, postgresProvider } from "./node.provider";

@Module({
  controllers: [NodeController],
  exports: [nodeProvider],
  imports: [ConfigModule, UserModule, forwardRef(() => ChannelModule)],
  providers: [natsProvider, nodeProvider, postgresProvider],
})
export class NodeModule {}
