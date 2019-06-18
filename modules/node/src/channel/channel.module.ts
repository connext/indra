import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { NodeModule } from "../node/node.module";
import { UserModule } from "../user/user.module";
import { UserRepository } from "../user/user.repository";

import { ChannelController } from "./channel.controller";
import { ChannelRepository } from "./channel.repository";
import { ChannelService } from "./channel.service";

@Module({
  controllers: [ChannelController],
  exports: [ChannelService],
  imports: [
    UserModule,
    NodeModule,
    TypeOrmModule.forFeature([ChannelRepository, UserRepository]),
  ],
  providers: [ChannelService],
})
export class ChannelModule {}
