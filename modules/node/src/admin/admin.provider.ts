import { IMessagingService } from "@connext/messaging";
import { FactoryProvider } from "@nestjs/common/interfaces";

import { AuthService } from "../auth/auth.service";
import { AdminMessagingProviderId, MessagingProviderId } from "../constants";
import { AbstractMessagingProvider } from "../util";

import { AdminService } from "./admin.service";

class AdminMessaging extends AbstractMessagingProvider {
  constructor(
    messaging: IMessagingService,
    private readonly adminService: AdminService,
    private readonly authService: AuthService,
  ) {
    super(messaging);
  }

  /**
   * October 30, 2019
   *
   * Some channels do not have a `freeBalanceAppInstance` key stored in their
   * state channel object at the path:
   * `{prefix}/{nodeXpub}/channel/{multisigAddress}`, meaning any attempts that
   * rely on checking the free balance (read: all app protocols) will fail.
   *
   * Additionally, any `restoreState` or state migration methods will fail
   * since they will be migrating corrupted states.
   *
   * This method will return the userXpub and the multisig address for all
   * channels that fit this description.
   */
  async getNoFreeBalance(): Promise<{ multisigAddress: string; userXpub: string }[]> {
    return await this.adminService.getNoFreeBalance();
  }

  async setupSubscriptions(): Promise<void> {
    await super.connectRequestReponse(
      "admin.get-no-free-balance",
      this.authService.useAdminToken(this.getNoFreeBalance.bind(this)),
    );
  }
}

export const adminProviderFactory: FactoryProvider<Promise<void>> = {
  inject: [MessagingProviderId, AdminService, AuthService],
  provide: AdminMessagingProviderId,
  useFactory: async (
    messaging: IMessagingService,
    adminService: AdminService,
    authService: AuthService,
  ): Promise<void> => {
    const admin = new AdminMessaging(messaging, adminService, authService);
    await admin.setupSubscriptions();
  },
};
