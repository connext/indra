import { Provider } from "@nestjs/common";
import { createConnection } from "typeorm";
import { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";

import { ConfigService } from "../config/config.service";
import { DatabaseProviderId } from "../constants";
import { User } from "../user/user.entity";

export const databaseProvider: Provider = {
  inject: [ConfigService],
  provide: DatabaseProviderId,
  useFactory: async (config: ConfigService) =>
    await createConnection({
      ...config.getPostgresConfig(),
      entities: [User],
      synchronize: true,
      type: "postgres",
    } as PostgresConnectionOptions),
};
