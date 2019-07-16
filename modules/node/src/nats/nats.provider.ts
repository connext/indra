import { FactoryProvider } from "@nestjs/common/interfaces";
import { ClientProxy, ClientProxyFactory, Transport } from "@nestjs/microservices";

import { ConfigService } from "../config/config.service";
import { NatsClientProviderId } from "../constants";

export const natsClient: FactoryProvider = {
  inject: [ConfigService],
  provide: NatsClientProviderId,
  useFactory: (config: ConfigService): ClientProxy => {
    const messagingUrl = config.getMessagingConfig().messagingUrl;
    return ClientProxyFactory.create({
      options: {
        servers: typeof messagingUrl === "string" ? [messagingUrl] : messagingUrl,
      },
      transport: Transport.NATS,
    });
  },
};
