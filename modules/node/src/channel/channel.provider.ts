import { FactoryProvider } from "@nestjs/common/interfaces";

import { NatsServiceFactory } from "../../../nats-messaging-client"; // FIXME
import { ChannelMessagingProviderId, NatsProviderId } from "../constants";

export const channelProvider: FactoryProvider = {
  inject: [NatsProviderId],
  provide: ChannelMessagingProviderId,
  useFactory: (natsProvider: NatsServiceFactory) => {
  }
}