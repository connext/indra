import { MessagingService } from "@connext/messaging";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { PinoLogger } from "nestjs-pino";

import { ConfigService } from "../config/config.service";
import { AuthService } from "../auth/auth.service";
import { MessagingProviderId } from "../constants";

export const messagingProviderFactory: FactoryProvider<Promise<MessagingService>> = {
  inject: [ConfigService, AuthService, PinoLogger],
  provide: MessagingProviderId,
  useFactory: async (
    config: ConfigService,
    auth: AuthService,
    log: PinoLogger,
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
