import { MessagingService } from "@connext/messaging";
import { StateChannelJSON, RebalanceProfile } from "@connext/types";
import { bigNumberifyJson, stringify } from "@connext/utils";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { RpcException } from "@nestjs/microservices";

import { AuthService } from "../auth/auth.service";
import { Channel } from "../channel/channel.entity";
import { LoggerService } from "../logger/logger.service";
import { AdminMessagingProviderId, MessagingProviderId } from "../constants";
import { ChannelService } from "../channel/channel.service";
import { AbstractMessagingProvider } from "../messaging/abstract.provider";

import { AdminService, RepairCriticalAddressesResponse } from "./admin.service";

class AdminMessaging extends AbstractMessagingProvider {
  constructor(
    private readonly authService: AuthService,
    public readonly log: LoggerService,
    messaging: MessagingService,
    private readonly adminService: AdminService,
    private readonly channelService: ChannelService,
  ) {
    super(log, messaging);
  }

  /**
   * October 30, 2019
   *
   * Some channels do not have a `freeBalanceAppInstance` key stored in their
   * state channel object at the path:
   * `{prefix}/{nodeAddress}/channel/{multisigAddress}`, meaning any attempts that
   * rely on checking the free balance (read: all app protocols) will fail.
   *
   * Additionally, any `restoreState` or state migration methods will fail
   * since they will be migrating corrupted states.
   *
   * This method will return the userAddress and the multisig address for all
   * channels that fit this description.
   */
  async getNoFreeBalance(): Promise<{ multisigAddress: string; userAddress: string; error: any }[]> {
    return this.adminService.getNoFreeBalance();
  }

  async getStateChannelByUserPublicIdentifier(data: {
    userIdentifier: string;
  }): Promise<StateChannelJSON> {
    const { userIdentifier } = data;
    if (!userIdentifier) {
      throw new RpcException(`No public identifier supplied: ${stringify(data)}`);
    }
    return this.adminService.getStateChannelByUserPublicIdentifier(userIdentifier);
  }

  async getStateChannelByMultisig(
    subject: string,
    data: { multisigAddress: string },
  ): Promise<StateChannelJSON> {
    const { multisigAddress } = data;
    if (!multisigAddress) {
      throw new RpcException(`No multisig address supplied: ${stringify(data)}`);
    }
    return this.adminService.getStateChannelByMultisig(multisigAddress);
  }

  async getAllChannels(): Promise<Channel[]> {
    return this.adminService.getAllChannels();
  }

  async getAllLinkedTransfers(): Promise<any> {
    return this.adminService.getAllLinkedTransfers();
  }

  async getLinkedTransferByPaymentId(data: { paymentId: string }): Promise<any> {
    const { paymentId } = data;
    if (!paymentId) {
      throw new RpcException(`No paymentId supplied: ${stringify(data)}`);
    }
    return this.adminService.getLinkedTransferByPaymentId(paymentId);
  }

  async getChannelsForMerging(): Promise<any[]> {
    return this.adminService.getChannelsForMerging();
  }

  async addRebalanceProfile(subject: string, data: { profile: RebalanceProfile }): Promise<void> {
    const address = subject.split(".")[1];
    const profile = bigNumberifyJson(data.profile) as RebalanceProfile;
    await this.channelService.addRebalanceProfileToChannel(address, profile);
  }

  async setupSubscriptions(): Promise<void> {
    await super.connectRequestReponse(
      "admin.get-no-free-balance",
      this.getNoFreeBalance.bind(this),
    );

    await super.connectRequestReponse(
      "admin.get-state-channel-by-address",
      this.getStateChannelByUserPublicIdentifier.bind(this),
    );

    await super.connectRequestReponse(
      "admin.get-state-channel-by-multisig",
      this.getStateChannelByMultisig.bind(this),
    );

    await super.connectRequestReponse("admin.get-all-channels", this.getAllChannels.bind(this));

    await super.connectRequestReponse(
      "admin.get-all-linked-transfers",
      this.getAllLinkedTransfers.bind(this),
    );

    await super.connectRequestReponse(
      "admin.get-linked-transfer-by-payment-id",
      this.getLinkedTransferByPaymentId.bind(this),
    );

    await super.connectRequestReponse(
      "admin.get-channels-for-merging",
      this.getChannelsForMerging.bind(this),
    );

    await super.connectRequestReponse(
      "admin.*.channel.add-profile",
      this.addRebalanceProfile.bind(this),
    );
  }
}

export const adminProviderFactory: FactoryProvider<Promise<void>> = {
  inject: [AuthService, LoggerService, MessagingProviderId, AdminService, ChannelService],
  provide: AdminMessagingProviderId,
  useFactory: async (
    authService: AuthService,
    log: LoggerService,
    messaging: MessagingService,
    adminService: AdminService,
    channelService: ChannelService,
  ): Promise<void> => {
    const admin = new AdminMessaging(authService, log, messaging, adminService, channelService);
    await admin.setupSubscriptions();
  },
};
