import { Provider } from "@nestjs/common";
import { Connection } from "typeorm";

import { ChannelRepoProviderId, DatabaseProviderId } from "../constants";

import { Channel } from "./channel.entity";

export const channelProvider: Provider = {
  inject: [DatabaseProviderId],
  provide: ChannelRepoProviderId,
  useFactory: (connection: Connection) => connection.getRepository(Channel),
};
