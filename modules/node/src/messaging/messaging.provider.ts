import { MessagingService } from "@connext/messaging";
// import { getMessagingPrefix } from "@connext/types";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { ClientProxy, ClientProxyFactory, Transport } from "@nestjs/microservices";

import { ConfigService } from "../config/config.service";
import { AuthService } from "../auth/auth.service";
import { LoggerService } from "../logger/logger.service";
import { MessagingClientProviderId, MessagingProviderId } from "../constants";

export const messagingProviderFactory: FactoryProvider<Promise<MessagingService>> = {
  inject: [ConfigService, AuthService, LoggerService],
  provide: MessagingProviderId,
  useFactory: async (
    config: ConfigService,
    auth: AuthService,
    log: LoggerService,
  ): Promise<MessagingService> => {
    log.setContext("MessagingProviderFactory");
    const getBearerToken = async (): Promise<string> => {
      return auth.vendAdminToken(config.getPublicIdentifier());
    };
    const network = await config.getEthNetwork();
    const messagingService = new MessagingService(
      config.getMessagingConfig(),
      // getMessagingPrefix(network.chainId),
      `INDRA.${network.chainId}`,
      getBearerToken,
    );
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
