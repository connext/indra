import { MessagingService } from "@connext/messaging";
import { FactoryProvider } from "@nestjs/common/interfaces";

import { ConfigService } from "../config/config.service";
import { AuthService } from "../auth/auth.service";
import { LoggerService } from "../logger/logger.service";
import { MessagingProviderId } from "../constants";

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
      const token = await auth.vendAdminToken(config.getPublicIdentifier());
      return token;
    };
    const messagingService = new MessagingService(
      config.getMessagingConfig(),
      config.getMessagingKey(),
      getBearerToken,
    );
    await messagingService.connect();
    return messagingService;
  },
};
