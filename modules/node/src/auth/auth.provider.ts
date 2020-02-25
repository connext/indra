import { IMessagingService } from "@connext/messaging";
import { FactoryProvider } from "@nestjs/common/interfaces";

import { LoggerService } from "../logger/logger.service";
import { AuthProviderId, MessagingProviderId } from "../constants";
import { AbstractMessagingProvider } from "../util";

import { AuthService } from "./auth.service";
import { RpcException } from "@nestjs/microservices";
import { stringify } from "querystring";

class AuthMessaging extends AbstractMessagingProvider {
  constructor(
    private readonly authService: AuthService,
    log: LoggerService,
    messaging: IMessagingService,
  ) {
    super(log, messaging);
  }

  async getNonce(subject: string, data: { address: string }): Promise<string> {
    if (!data.address) {
      throw new RpcException(`No address found in data: ${stringify(data)}`);
    }
    return this.authService.getNonce(data.address);
  }

  async setupSubscriptions(): Promise<void> {
    super.connectRequestReponse(`auth.getNonce`, this.getNonce.bind(this));
  }
}

export const authProviderFactory: FactoryProvider<Promise<void>> = {
  inject: [AuthService, LoggerService, MessagingProviderId],
  provide: AuthProviderId,
  useFactory: async (
    authService: AuthService,
    log: LoggerService,
    messaging: IMessagingService,
  ): Promise<void> => {
    const auth = new AuthMessaging(authService, log, messaging);
    await auth.setupSubscriptions();
  },
};
