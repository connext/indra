import { Module } from "@nestjs/common";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AppRegistryModule } from "./appRegistry/appRegistry.module";
import { CFCoreController } from "./cfCore/cfCore.controller";
import { CFCoreModule } from "./cfCore/cfCore.module";
import { ChannelModule } from "./channel/channel.module";
import { ConfigModule } from "./config/config.module";
import { DatabaseModule } from "./database/database.module";
import { ListenerModule } from "./listener/listener.module";
import { LockModule } from "./lock/lock.module";
import { MessagingModule } from "./messaging/messaging.module";
import { RedisModule } from "./redis/redis.module";
import { SwapRateModule } from "./swapRate/swapRate.module";
import { TransferModule } from "./transfer/transfer.module";

@Module({
  controllers: [AppController, CFCoreController],
  exports: [ConfigModule],
  imports: [
    DatabaseModule,
    ConfigModule,
    CFCoreModule,
    ChannelModule,
    MessagingModule,
    SwapRateModule,
    AppRegistryModule,
    TransferModule,
    ListenerModule,
    RedisModule,
    LockModule,
  ],
  providers: [AppService],
})
export class AppModule {}
