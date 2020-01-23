import { IMessagingService } from "@connext/messaging";
import { FactoryProvider } from "@nestjs/common/interfaces";

import { AuthProviderId, MessagingProviderId } from "../constants";
import { AbstractMessagingProvider } from "../util";

import { AuthService } from "./auth.service";
import { RpcException } from "@nestjs/microservices";
import { stringify } from "querystring";

class AuthMessaging extends AbstractMessagingProvider {
  constructor(messaging: IMessagingService, private readonly authService: AuthService) {
    super(messaging);
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
  inject: [MessagingProviderId, AuthService],
  provide: AuthProviderId,
  useFactory: async (messaging: IMessagingService, authService: AuthService): Promise<void> => {
    const auth = new AuthMessaging(messaging, authService);
    await auth.setupSubscriptions();
  },
};
