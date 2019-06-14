import { Provider } from "@nestjs/common";
import { createConnection } from "typeorm";
import { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";

import { App, AppUpdate } from "../app/app.entity";
import { AppRegistry } from "../appRegistry/appRegistry.entity";
import { Channel, ChannelUpdate } from "../channel/channel.entity";
import { ConfigService } from "../config/config.service";
import { DatabaseProviderId } from "../constants";
import { User } from "../user/user.entity";

export const databaseProvider: Provider = {
  inject: [ConfigService],
  provide: DatabaseProviderId,
  useFactory: async (config: ConfigService) =>
    createConnection({
      ...config.getPostgresConfig(),
      entities: [App, AppRegistry, AppUpdate, Channel, ChannelUpdate, User],
      synchronize: true,
      type: "postgres",
    } as PostgresConnectionOptions),
};
