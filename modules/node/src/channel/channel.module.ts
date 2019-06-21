import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { ConfigModule } from "../config/config.module";
import { NodeModule } from "../node/node.module";
import { UserModule } from "../user/user.module";
import { UserRepository } from "../user/user.repository";

import { ChannelController } from "./channel.controller";
import { channelProvider } from "./channel.provider";
import { ChannelRepository, NodeChannelRepository } from "./channel.repository";
import { ChannelService } from "./channel.service";

@Module({
  controllers: [ChannelController],
  exports: [ChannelService, channelProvider],
  imports: [
    UserModule,
    NodeModule,
    TypeOrmModule.forFeature([ChannelRepository, UserRepository, NodeChannelRepository]),
    ConfigModule,
  ],
  providers: [ChannelService, channelProvider],
})
export class ChannelModule {}
