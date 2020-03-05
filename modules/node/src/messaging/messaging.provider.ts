import { MessagingService, MessagingAuthService } from "@connext/messaging";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { ClientProxy, ClientProxyFactory, Transport } from "@nestjs/microservices";

import { ConfigService } from "../config/config.service";
import { AuthService } from "../auth/auth.service";
import { LoggerService } from "../logger/logger.service";
import {
  MessagingClientProviderId,
  MessagingProviderId,
  MessagingAuthProviderId,
} from "../constants";

export const messagingProviderFactory: FactoryProvider<Promise<MessagingService>> = {
  inject: [ConfigService, AuthService, LoggerService],
  provide: MessagingProviderId,
  useFactory: async (
    config: ConfigService,
    auth: AuthService,
    log: LoggerService,
  ): Promise<MessagingService> => {
    const getBearerToken = async (): Promise<string> => {
      const nonce = await auth.getNonce(config.publicIdentifier);
      log.info(`Got nonce from authService: ${nonce}`);
      const signedNonce = await config.getEthWallet().signMessage(nonce);
      return auth.verifyAndVend(signedNonce, config.publicIdentifier);
    };
    const messagingService = new MessagingService(
      config.getMessagingConfig(),
      "indra",
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
