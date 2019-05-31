import { Provider } from "@nestjs/common";
import { createConnection } from "typeorm";
import { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";

import { DatabaseProviderId } from "../constants";

export const databaseProvider: Provider = {
  provide: DatabaseProviderId,
  useFactory: async () =>
    await createConnection({
      type: "postgres",
      host: "localhost",
      port: 5432,
      username: "root",
      password: "root",
      database: "test",
      entities: [__dirname + "/../**/*.entity{.ts,.js}"],
      synchronize: true,
    } as PostgresConnectionOptions),
};
