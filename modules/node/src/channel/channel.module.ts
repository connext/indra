import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { ConfigModule } from "../config/config.module";
import { NodeModule } from "../node/node.module";
import { PaymentProfileRepository } from "../paymentProfile/paymentProfile.repository";
import { UserModule } from "../user/user.module";
import { UserRepository } from "../user/user.repository";

import { channelProvider } from "./channel.provider";
import { ChannelRepository } from "./channel.repository";
import { ChannelService } from "./channel.service";
import { AppRegistryRepository } from "../appRegistry/appRegistry.repository";

@Module({
  controllers: [],
  exports: [ChannelService, channelProvider],
  imports: [
    UserModule,
    NodeModule,
    TypeOrmModule.forFeature([ChannelRepository, UserRepository, PaymentProfileRepository, AppRegistryRepository]),
    ConfigModule,
  ],
  providers: [ChannelService, channelProvider],
})
export class ChannelModule {}
