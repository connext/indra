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
  async getNoFreeBalance(): Promise<{ multisigAddress: string; userXpub: string; error: any }[]> {
    return await this.adminService.getNoFreeBalance();
  }

  async getChannelStates(userPublicIdentifier: any):  Promise<any[]> {
    return await this.adminService.getChannelStates(userPublicIdentifier);
  }

  async getIncorrectMultisigAddresses(): Promise<
    {
      oldMultisigAddress: string;
      expectedMultisigAddress: string;
      userXpub: string;
      channelId: number;
    }[]
  > {
    return await this.adminService.getIncorrectMultisigAddresses();
  }

  async getChannelsForMerging(): Promise<any[]> {
    return await this.adminService.getChannelsForMerging();
  }

  async setupSubscriptions(): Promise<void> {
    await super.connectRequestReponse(
      "admin.get-no-free-balance",
      this.authService.useAdminToken(this.getNoFreeBalance.bind(this)),
    );

    await super.connectRequestReponse(
      "admin.get-channel-states",
      this.authService.useAdminToken(this.getChannelStates.bind(this)),
    );

    await super.connectRequestReponse(
      "admin.get-incorrect-multisig",
      this.authService.useAdminToken(this.getIncorrectMultisigAddresses.bind(this)),
    );

    await super.connectRequestReponse(
      "admin.get-channels-for-merging",
      this.authService.useAdminToken(this.getChannelsForMerging.bind(this)),
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
