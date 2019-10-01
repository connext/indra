import { IMessagingService } from "@connext/messaging";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { hexlify, randomBytes } from "ethers/utils";

import { AuthProviderId, MessagingProviderId } from "../constants";
import { AbstractMessagingProvider } from "../util";

import { AuthService } from "./auth.service";

class AuthMessaging extends AbstractMessagingProvider {
  constructor(messaging: IMessagingService, private readonly authService: AuthService) {
    super(messaging);
  }

  async getAuth(subject: string, data: { authValue: string }): Promise<string> {
    const authName = subject.split(".").pop(); // last item of subject is auth name
    return this.authService.getAuth(authName, data.authValue);
  }

  async setupSubscriptions(): Promise<void> {
    super.connectRequestReponse("auth.get", this.getAuth.bind(this));
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
