import { Module } from "@nestjs/common";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { ChannelController } from "./channel/channel.controller";
import { ChannelModule } from "./channel/channel.module";
import { ConfigModule } from "./config/config.module";
import { NodeController } from "./node/node.controller";
import { NodeModule } from "./node/node.module";
import { UserModule } from "./user/user.module";

@Module({
  imports: [ConfigModule, NodeModule, UserModule, ChannelModule],
  controllers: [AppController, NodeController, ChannelController],
  providers: [AppService],
})
export class AppModule {}
