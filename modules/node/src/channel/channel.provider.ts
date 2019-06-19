import { NatsMessagingService } from "@connext/nats-messaging-client";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { RpcException } from "@nestjs/microservices";
import { Client } from "ts-nats";

import { ChannelMessagingProviderId, NatsProviderId } from "../constants";

async function setupSubscriptions(natsClient: Client) {
  await natsClient.subscribe("greeter", (err, msg) => {
    if (err) {
      throw new RpcException("")
    } else if (msg.reply) {
      natsClient.publish(msg.reply, `hello there ${msg.data}`);
    }
  });
}

export const channelProvider: FactoryProvider = {
  inject: [NatsProviderId],
  provide: ChannelMessagingProviderId,
  useFactory: (nats: NatsMessagingService) => {
    const client = nats.getConnection();
  },
};
