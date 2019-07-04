import { Module } from "@nestjs/common";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { App, AppUpdate } from "./app/app.entity";
import { AppRegistry } from "./appRegistry/appRegistry.entity";
import { Channel, ChannelUpdate, NodeChannel } from "./channel/channel.entity";
import { ChannelModule } from "./channel/channel.module";
import { ConfigModule } from "./config/config.module";
import { DatabaseModule } from "./database/database.module";
import { NodeController } from "./node/node.controller";
import { NodeModule } from "./node/node.module";
import { User } from "./user/user.entity";
import { UserModule } from "./user/user.module";

export const entities = [App, AppRegistry, AppUpdate, Channel, ChannelUpdate, User];
export const viewEntites = [NodeChannel];

@Module({
  controllers: [AppController, NodeController],
  exports: [ConfigModule],
  imports: [ConfigModule, NodeModule, UserModule, ChannelModule,DatabaseModule],
  providers: [AppService],
})
export class AppModule {}
