import { Module } from "@nestjs/common";

import { AppRegistryModule } from "../appRegistry/appRegistry.module";
import { ChannelModule } from "../channel/channel.module";
import { NodeModule } from "../node/node.module";
import { TransferModule } from "../transfer/transfer.module";

import ListenerService from "./listener.service";

@Module({
  controllers: [],
  exports: [ListenerService],
  imports: [NodeModule, AppRegistryModule, ChannelModule, TransferModule],
  providers: [ListenerService],
})
export class ListenerModule {}
