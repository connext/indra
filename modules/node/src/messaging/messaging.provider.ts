import { MessagingService, MessagingServiceFactory } from "@connext/messaging";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { ClientProxy, ClientProxyFactory, Transport } from "@nestjs/microservices";

import { ConfigService } from "../config/config.service";
import { MessagingClientProviderId, MessagingProviderId } from "../constants";

export const messagingProviderFactory: FactoryProvider<Promise<MessagingService>> = {
  inject: [ConfigService],
  provide: MessagingProviderId,
  useFactory: async (config: ConfigService): Promise<MessagingService> => {
    const messagingFactory = new MessagingServiceFactory(config.getMessagingConfig());
    const messagingService = messagingFactory.createService("messaging");
    await messagingService.connect();
    return messagingService;
  },
};

export const messagingClientFactory: FactoryProvider = {
  inject: [ConfigService],
  provide: MessagingClientProviderId,
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
