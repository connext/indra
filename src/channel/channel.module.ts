import { Module } from "@nestjs/common";

import { NodeModule } from "../node/node.module";
import { UserModule } from "../user/user.module";

import { ChannelController } from "./channel.controller";
import { ChannelService } from "./channel.service";

@Module({
  imports: [UserModule, NodeModule],
  providers: [ChannelService],
  controllers: [ChannelController],
  exports: [ChannelService],
})
export class ChannelModule {}
