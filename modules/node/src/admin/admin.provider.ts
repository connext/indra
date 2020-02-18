import { IMessagingService } from "@connext/messaging";
import { StateChannelJSON } from "@connext/types";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { RpcException } from "@nestjs/microservices";

import { AuthService } from "../auth/auth.service";
import { Channel } from "../channel/channel.entity";
import { AdminMessagingProviderId, MessagingProviderId } from "../constants";
import { LinkedTransfer } from "../transfer/transfer.entity";
import { AbstractMessagingProvider, stringify } from "../util";

import { AdminService, RepairCriticalAddressesResponse } from "./admin.service";

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

  async getStateChannelByUserPublicIdentifier(data: {
    userPublicIdentifier: string;
  }): Promise<StateChannelJSON> {
    const { userPublicIdentifier } = data;
    if (!userPublicIdentifier) {
      throw new RpcException(`No public identifier supplied: ${stringify(data)}`);
    }
    return await this.adminService.getStateChannelByUserPublicIdentifier(userPublicIdentifier);
  }

  async getStateChannelByMultisig(data: { multisigAddress: string }): Promise<StateChannelJSON> {
    const { multisigAddress } = data;
    if (!multisigAddress) {
      throw new RpcException(`No multisig address supplied: ${stringify(data)}`);
    }
    return await this.adminService.getStateChannelByMultisig(multisigAddress);
  }

  async getAllChannels(): Promise<Channel[]> {
    return await this.adminService.getAllChannels();
  }

  async getAllLinkedTransfers(): Promise<LinkedTransfer[]> {
    return await this.adminService.getAllLinkedTransfers();
  }

  async getLinkedTransfersByRecipientPublicIdentifier(data: {
    publicIdentifier: string;
  }): Promise<LinkedTransfer[]> {
    const { publicIdentifier } = data;
    if (!publicIdentifier) {
      throw new RpcException(`No public identifier supplied: ${stringify(data)}`);
    }
    return await this.adminService.getLinkedTransfersByRecipientPublicIdentifier(publicIdentifier);
  }

  async getLinkedTransferByPaymentId(data: {
    paymentId: string;
  }): Promise<LinkedTransfer | undefined> {
    const { paymentId } = data;
    if (!paymentId) {
      throw new RpcException(`No paymentId supplied: ${stringify(data)}`);
    }
    return await this.adminService.getLinkedTransferByPaymentId(paymentId);
  }

  async getChannelsForMerging(): Promise<any[]> {
    return await this.adminService.getChannelsForMerging();
  }

  async repairCriticalStateChannelAddresses(): Promise<RepairCriticalAddressesResponse> {
    return await this.adminService.repairCriticalStateChannelAddresses();
  }

  async setupSubscriptions(): Promise<void> {
    await super.connectRequestReponse(
      "admin.get-no-free-balance",
      this.authService.useAdminToken(this.getNoFreeBalance.bind(this)),
    );

    await super.connectRequestReponse(
      "admin.get-state-channel-by-xpub",
      this.authService.useAdminToken(this.getStateChannelByUserPublicIdentifier.bind(this)),
    );

    await super.connectRequestReponse(
      "admin.get-state-channel-by-multisig",
      this.authService.useAdminToken(this.getStateChannelByMultisig.bind(this)),
    );

    await super.connectRequestReponse(
      "admin.get-all-channels",
      this.authService.useAdminToken(this.getAllChannels.bind(this)),
    );

    await super.connectRequestReponse(
      "admin.get-all-linked-transfers",
      this.authService.useAdminToken(this.getAllLinkedTransfers.bind(this)),
    );

    await super.connectRequestReponse(
      "admin.get-linked-transfer-by-payment-id",
      this.authService.useAdminToken(this.getLinkedTransferByPaymentId.bind(this)),
    );   

    await super.connectRequestReponse(
      "admin.get-linked-transfers-by-recipient-xpub",
      this.authService.useAdminToken(this.getLinkedTransfersByRecipientPublicIdentifier.bind(this)),
    );   

    await super.connectRequestReponse(
      "admin.get-channels-for-merging",
      this.authService.useAdminToken(this.getChannelsForMerging.bind(this)),
    );

    await super.connectRequestReponse(
      "admin.repair-critical-addresses",
      this.authService.useAdminToken(this.repairCriticalStateChannelAddresses.bind(this)),
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
