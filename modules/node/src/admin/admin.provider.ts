import { MessagingService } from "@connext/messaging";
import { StateChannelJSON } from "@connext/types";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { RpcException } from "@nestjs/microservices";

import { AuthService } from "../auth/auth.service";
import { Channel } from "../channel/channel.entity";
import { LoggerService } from "../logger/logger.service";
import { AdminMessagingProviderId, MessagingProviderId } from "../constants";
import { LinkedTransfer } from "../transfer/transfer.entity";
import { AbstractMessagingProvider, stringify } from "../util";

import { AdminService, RepairCriticalAddressesResponse } from "./admin.service";

class AdminMessaging extends AbstractMessagingProvider {
  constructor(
    private readonly adminService: AdminService,
    private readonly authService: AuthService,
    public readonly log: LoggerService,
    messaging: MessagingService,
  ) {
    super(log, messaging);
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
      this.authService.parseXpub(this.getNoFreeBalance.bind(this)),
    );

    await super.connectRequestReponse(
      "admin.get-state-channel-by-xpub",
      this.authService.parseXpub(this.getStateChannelByUserPublicIdentifier.bind(this)),
    );

    await super.connectRequestReponse(
      "admin.get-state-channel-by-multisig",
      this.authService.parseXpub(this.getStateChannelByMultisig.bind(this)),
    );

    await super.connectRequestReponse(
      "admin.get-all-channels",
      this.authService.parseXpub(this.getAllChannels.bind(this)),
    );

    await super.connectRequestReponse(
      "admin.get-all-linked-transfers",
      this.authService.parseXpub(this.getAllLinkedTransfers.bind(this)),
    );

    await super.connectRequestReponse(
      "admin.get-linked-transfer-by-payment-id",
      this.authService.parseXpub(this.getLinkedTransferByPaymentId.bind(this)),
    );

    await super.connectRequestReponse(
      "admin.get-channels-for-merging",
      this.authService.parseXpub(this.getChannelsForMerging.bind(this)),
    );

    await super.connectRequestReponse(
      "admin.repair-critical-addresses",
      this.authService.parseXpub(this.repairCriticalStateChannelAddresses.bind(this)),
    );
  }
}

export const adminProviderFactory: FactoryProvider<Promise<void>> = {
  inject: [AdminService, AuthService, LoggerService, MessagingProviderId],
  provide: AdminMessagingProviderId,
  useFactory: async (
    adminService: AdminService,
    authService: AuthService,
    log: LoggerService,
    messaging: MessagingService,
  ): Promise<void> => {
    const admin = new AdminMessaging(adminService, authService, log, messaging);
    await admin.setupSubscriptions();
  },
};
