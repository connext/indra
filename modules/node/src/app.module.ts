import { Module } from "@nestjs/common";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AppRegistryModule } from "./appRegistry/appRegistry.module";
import { ChannelModule } from "./channel/channel.module";
import { ConfigModule } from "./config/config.module";
import { DatabaseModule } from "./database/database.module";
import { ListenerModule } from "./listener/listener.module";
import { MessagingModule } from "./messaging/messaging.module";
import { NodeController } from "./node/node.controller";
import { NodeModule } from "./node/node.module";
import { SwapRateModule } from "./swapRate/swapRate.module";
import { TransferModule } from "./transfer/transfer.module";

@Module({
  controllers: [AppController, NodeController],
  exports: [ConfigModule],
  imports: [
    DatabaseModule,
    ConfigModule,
    NodeModule,
    ChannelModule,
    MessagingModule,
    SwapRateModule,
    AppRegistryModule,
    TransferModule,
    ListenerModule,
  ],
  providers: [AppService],
})
export class AppModule {}
