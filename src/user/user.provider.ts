import { Provider } from "@nestjs/common";
import { Connection } from "typeorm";

import { DatabaseProviderId, UserRepoProviderId } from "../constants";

import { User } from "./user.entity";

export const userProvider: Provider = {
  provide: UserRepoProviderId,
  useFactory: (connection: Connection) => connection.getRepository(User),
  inject: [DatabaseProviderId],
};
