import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { App, AppUpdate } from "./app/app.entity";
import { AppRegistry } from "./appRegistry/appRegistry.entity";
import { Channel, ChannelUpdate, NodeChannel } from "./channel/channel.entity";
import { ChannelModule } from "./channel/channel.module";
import { ConfigModule } from "./config/config.module";
import { ConfigService } from "./config/config.service";
import { NodeController } from "./node/node.controller";
import { NodeModule } from "./node/node.module";
import { User } from "./user/user.entity";
import { UserModule } from "./user/user.module";

export const entities = [App, AppRegistry, AppUpdate, Channel, ChannelUpdate, User];
export const viewEntites = [NodeChannel];

@Module({
  controllers: [AppController, NodeController],
  exports: [ConfigModule],
  imports: [
    ConfigModule,
    NodeModule,
    UserModule,
    ChannelModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService): Promise<any> => {
        return {
          ...config.getPostgresConfig(),
          entities: [...entities, ...viewEntites],
          synchronize: true,
          type: "postgres",
        } as PostgresConnectionOptions;
      },
    }),
  ],
  providers: [AppService],
})
export class AppModule {}
