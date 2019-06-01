import { Provider } from "@nestjs/common";
import { createConnection } from "typeorm";
import { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";

import { DatabaseProviderId } from "../constants";
import { User } from "../user/user.entity";

export const databaseProvider: Provider = {
  provide: DatabaseProviderId,
  useFactory: async () =>
    await createConnection({
      type: "postgres",
      host: "localhost",
      port: 5432,
      username: "rahul",
      password: "qwerty",
      database: "node",
      entities: [User],
      synchronize: true,
    } as PostgresConnectionOptions),
};
