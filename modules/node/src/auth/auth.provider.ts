import { FactoryProvider } from "@nestjs/common";
import { MessagingAuthService } from "@connext/messaging";

import { ConfigService } from "../config/config.service";
import { MessagingAuthProviderId } from "../constants";

export const messagingAuthProviderFactory: FactoryProvider<Promise<MessagingAuthService>> = {
  inject: [ConfigService],
  provide: MessagingAuthProviderId,
  useFactory: async (config: ConfigService): Promise<MessagingAuthService> => {
    return new MessagingAuthService(config.getMessagingConfig());
  },
};
