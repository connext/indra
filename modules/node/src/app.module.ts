import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";

import { AdminModule } from "./admin/admin.module";
import { AppRegistryModule } from "./appRegistry/appRegistry.module";
import { AuthModule } from "./auth/auth.module";
import { CacheModule } from "./caching/cache.module";
import { CFCoreModule } from "./cfCore/cfCore.module";
import { ChannelModule } from "./channel/channel.module";
import { CollateralModule } from "./collateral/collateral.module";
import { ConfigModule } from "./config/config.module";
import { DatabaseModule } from "./database/database.module";
import { DepositModule } from "./deposit/deposit.module";
import { HashLockTransferModule } from "./hashLockTransfer/hashLockTransfer.module";
import { LinkedTransferModule } from "./linkedTransfer/linkedTransfer.module";
import { ListenerModule } from "./listener/listener.module";
import { LockModule } from "./lock/lock.module";
import { LoggerModule } from "./logger/logger.module";
import { MessagingModule } from "./messaging/messaging.module";
import { RedisModule } from "./redis/redis.module";
import { SignedTransferModule } from "./signedTransfer/signedTransfer.module";
import { SwapRateModule } from "./swapRate/swapRate.module";
import { TransferModule } from "./transfer/transfer.module";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";

@Module({
  controllers: [AppController],
  exports: [ConfigModule, LoggerModule, AuthModule],
  imports: [
    AdminModule,
    AppRegistryModule,
    AuthModule,
    CacheModule,
    CFCoreModule,
    ChannelModule,
    CollateralModule,
    ConfigModule,
    DatabaseModule,
    DepositModule,
    HashLockTransferModule,
    LinkedTransferModule,
    ListenerModule,
    LockModule,
    LoggerModule,
    MessagingModule,
    RedisModule,
    ScheduleModule.forRoot(),
    SignedTransferModule,
    SwapRateModule,
    TransferModule,
  ],
  providers: [AppService],
})
export class AppModule {}
