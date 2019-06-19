import { NatsMessagingService } from "@connext/nats-messaging-client";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { Client } from "ts-nats";

import { ChannelMessagingProviderId, NatsProviderId } from "../constants";
import { User } from "../user/user.entity";
import { UserRepository } from "../user/user.repository";
import { BaseNatsProvider } from "../util/nats";

export class ChannelNats extends BaseNatsProvider {
  constructor(natsClient: Client, private readonly userRepo: UserRepository) {
    super(natsClient);
  }

  // TODO: validation
  async getChannel(subject: string): Promise<User> {
    const xpub = subject.split(".").pop();
    return await this.userRepo.findByXpub(xpub);
  }

  setupSubscriptions(): void {
    super.connectRequestReponse("channel.get.>", this.getChannel);
  }
}

export const channelProvider: FactoryProvider<Promise<Client>> = {
  inject: [NatsProviderId, UserRepository],
  provide: ChannelMessagingProviderId,
  useFactory: async (nats: NatsMessagingService, userRepo: UserRepository): Promise<Client> => {
    const client = nats.getConnection();
    const channel = new ChannelNats(client, userRepo);
    await channel.setupSubscriptions();
    return client;
  },
};
