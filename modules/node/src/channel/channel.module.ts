import { forwardRef, Module } from "@nestjs/common";

import { NodeModule } from "../node/node.module";
import { UserModule } from "../user/user.module";

import { ChannelController } from "./channel.controller";
import { ChannelService } from "./channel.service";

@Module({
  controllers: [ChannelController],
  exports: [ChannelService],
  imports: [UserModule, forwardRef(() => NodeModule)],
  providers: [ChannelService],
})
export class ChannelModule {}
