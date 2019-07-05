import { Module } from "@nestjs/common";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { ChannelModule } from "./channel/channel.module";
import { ConfigModule } from "./config/config.module";
import { DatabaseModule } from "./database/database.module";
import { NodeController } from "./node/node.controller";
import { NodeModule } from "./node/node.module";
import { UserModule } from "./user/user.module";

@Module({
  controllers: [AppController, NodeController],
  exports: [ConfigModule],
  imports: [ConfigModule, NodeModule, UserModule, ChannelModule, DatabaseModule],
  providers: [AppService],
})
export class AppModule {}
