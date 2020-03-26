import {
  MethodResults,
  ChannelAppSequences,
  GetChannelResponse,
  StateChannelJSON,
} from "@connext/types";
import { MessagingService } from "@connext/messaging";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { getAddress } from "ethers/utils";

import { AuthService } from "../auth/auth.service";
import { LoggerService } from "../logger/logger.service";
import { ChannelMessagingProviderId, MessagingProviderId } from "../constants";
import { OnchainTransaction } from "../onchainTransactions/onchainTransaction.entity";
import { AbstractMessagingProvider } from "../util";
import { OnchainTransactionRepository } from "../onchainTransactions/onchainTransaction.repository";

import { RebalanceProfile } from "../rebalanceProfile/rebalanceProfile.entity";

import { ChannelRepository } from "./channel.repository";
import { ChannelService, RebalanceType } from "./channel.service";

class ChannelMessaging extends AbstractMessagingProvider {
  constructor(
    private readonly authService: AuthService,
    log: LoggerService,
    messaging: MessagingService,
    private readonly channelService: ChannelService,
    private readonly channelRepository: ChannelRepository,
    private readonly onchainTransactionRepository: OnchainTransactionRepository,
  ) {
    super(log, messaging);
  }

  async getChannel(pubId: string, data?: unknown): Promise<GetChannelResponse | undefined> {
    const channel = await this.channelRepository.findByUserPublicIdentifier(pubId);
    return !channel ? undefined : ({
      id: channel.id,
      available: channel.available,
      collateralizationInFlight: channel.collateralizationInFlight,
      multisigAddress: channel.multisigAddress,
      nodePublicIdentifier: channel.nodePublicIdentifier,
      userPublicIdentifier: channel.userPublicIdentifier,
    });
  }

  async createChannel(pubId: string): Promise<MethodResults.CreateChannel> {
    return await this.channelService.create(pubId);
  }

  async verifyAppSequenceNumber(
    pubId: string,
    data: { userAppSequenceNumber: number },
  ): Promise<ChannelAppSequences> {
    return await this.channelService.verifyAppSequenceNumber(pubId, data.userAppSequenceNumber);
  }

  async requestCollateral(
    pubId: string,
    data: { assetId?: string },
  ): Promise<MethodResults.Deposit> {
    // do not allow clients to specify an amount to collateralize with
    return (await (this.channelService.rebalance(
      pubId,
      getAddress(data.assetId),
      RebalanceType.COLLATERALIZE,
    ) as unknown)) as MethodResults.Deposit;
  }

  async addRebalanceProfile(pubId: string, data: { profile: RebalanceProfile }): Promise<void> {
    await this.channelService.addRebalanceProfileToChannel(pubId, data.profile);
  }

  async getRebalanceProfile(
    pubId: string,
    data: { assetId?: string },
  ): Promise<RebalanceProfile | undefined> {
    const prof = await this.channelRepository.getRebalanceProfileForChannelAndAsset(
      pubId,
      data.assetId,
    );
    return prof ? prof : undefined;
  }

  async getLatestWithdrawal(pubId: string, data: {}): Promise<OnchainTransaction | undefined> {
    return this.onchainTransactionRepository.findLatestWithdrawalByUserPublicIdentifier(pubId);
  }

  async getChannelStateForRestore(pubId: string): Promise<StateChannelJSON> {
    return await this.channelService.getStateChannel(pubId);
  }

  async setupSubscriptions(): Promise<void> {
    await super.connectRequestReponse(
      "*.channel.get",
      this.authService.parseXpub(this.getChannel.bind(this)),
    );
    await super.connectRequestReponse(
      "*.channel.create",
      this.authService.parseXpub(this.createChannel.bind(this)),
    );
    await super.connectRequestReponse(
      "*.channel.request-collateral",
      this.authService.parseXpub(this.requestCollateral.bind(this)),
    );
    await super.connectRequestReponse(
      "*.channel.get-profile",
      this.authService.parseXpub(this.getRebalanceProfile.bind(this)),
    );
    await super.connectRequestReponse(
      "*.channel.verify-app-sequence",
      this.authService.parseXpub(this.verifyAppSequenceNumber.bind(this)),
    );
    await super.connectRequestReponse(
      "*.channel.restore-states",
      this.authService.parseXpub(this.getChannelStateForRestore.bind(this)),
    );
    await super.connectRequestReponse(
      "*.channel.latestWithdrawal",
      this.authService.parseXpub(this.getLatestWithdrawal.bind(this)),
    );
  }
}

export const channelProviderFactory: FactoryProvider<Promise<void>> = {
  inject: [
    AuthService,
    LoggerService,
    MessagingProviderId,
    ChannelService,
    ChannelRepository,
    OnchainTransactionRepository,
  ],
  provide: ChannelMessagingProviderId,
  useFactory: async (
    authService: AuthService,
    log: LoggerService,
    messaging: MessagingService,
    channelService: ChannelService,
    channelRepo: ChannelRepository,
    onchain: OnchainTransactionRepository,
  ): Promise<void> => {
    const channel = new ChannelMessaging(
      authService,
      log,
      messaging,
      channelService,
      channelRepo,
      onchain,
    );
    await channel.setupSubscriptions();
  },
};
