import { forwardRef, Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module";
import { NodeModule } from "../node/node.module";
import { UserModule } from "../user/user.module";

import { ChannelController } from "./channel.controller";
import { channelProvider } from "./channel.provider";
import { ChannelService } from "./channel.service";

@Module({
  controllers: [ChannelController],
  exports: [ChannelService],
  imports: [DatabaseModule, UserModule, forwardRef(() => NodeModule)],
  providers: [ChannelService, channelProvider],
})
export class ChannelModule {}
