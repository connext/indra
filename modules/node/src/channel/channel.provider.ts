import { IMessagingService } from "@connext/messaging";
import {
  MinimalTransaction,
  MethodResults,
  ChannelAppSequences,
  GetChannelResponse,
  GetConfigResponse,
  StateChannelJSON,
} from "@connext/types";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { getAddress } from "ethers/utils";

import { AuthService } from "../auth/auth.service";
import { LoggerService } from "../logger/logger.service";
import { WithdrawService } from "../withdraw/withdraw.service";
import { ChannelMessagingProviderId, MessagingProviderId } from "../constants";
import { OnchainTransaction } from "../onchainTransactions/onchainTransaction.entity";
import { AbstractMessagingProvider } from "../util";
import { OnchainTransactionRepository } from "../onchainTransactions/onchainTransaction.repository";
import { CFCoreService } from "../cfCore/cfCore.service";

import { RebalanceProfile } from "../rebalanceProfile/rebalanceProfile.entity";

import { ChannelRepository } from "./channel.repository";
import { ChannelService, RebalanceType } from "./channel.service";

class ChannelMessaging extends AbstractMessagingProvider {
  constructor(
    private readonly authService: AuthService,
    private readonly channelRepository: ChannelRepository,
    private readonly channelService: ChannelService,
    private readonly withdrawService: WithdrawService,
    private readonly cfCoreService: CFCoreService,
    private readonly onchainTransactionRepository: OnchainTransactionRepository,
    log: LoggerService,
    messaging: IMessagingService,
  ) {
    super(log, messaging);
  }

  async getConfig(): Promise<GetConfigResponse> {
    return await this.channelService.getConfig();
  }

  async getChannel(pubId: string, data?: unknown): Promise<GetChannelResponse> {
    return (await this.channelRepository.findByUserPublicIdentifier(pubId)) as GetChannelResponse;
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

<<<<<<< HEAD
  async withdraw(
    pubId: string,
    data: { tx: MinimalTransaction },
  ): Promise<TransactionResponse> {
    return await this.channelService.withdrawForClient(pubId, data.tx);
  }

=======
>>>>>>> 845-store-refactor
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

  async getStatesForRestore(pubId: string): Promise<StateChannelJSON> {
    return await this.channelService.getStateChannel(pubId);
  }

  async setupSubscriptions(): Promise<void> {
    await super.connectRequestReponse(
      "channel.get.>",
      this.authService.useUnverifiedPublicIdentifier(this.getChannel.bind(this)),
    );
    await super.connectRequestReponse(
      "channel.create.>",
      this.authService.useUnverifiedPublicIdentifier(this.createChannel.bind(this)),
    );
    await super.connectRequestReponse(
      "channel.request-collateral.>",
      this.authService.useUnverifiedPublicIdentifier(this.requestCollateral.bind(this)),
    );
    await super.connectRequestReponse(
      "channel.add-profile.>",
      this.authService.useAdminTokenWithPublicIdentifier(this.addRebalanceProfile.bind(this)),
    );
    await super.connectRequestReponse(
      "channel.get-profile.>",
      this.authService.useUnverifiedPublicIdentifier(this.getRebalanceProfile.bind(this)),
    );
    await super.connectRequestReponse(
      "channel.verify-app-sequence.>",
      this.authService.useUnverifiedPublicIdentifier(this.verifyAppSequenceNumber.bind(this)),
    );
    await super.connectRequestReponse(
      "channel.restore-states.>",
      this.authService.useUnverifiedPublicIdentifier(this.getStatesForRestore.bind(this)),
    );
    await super.connectRequestReponse(
      "channel.latestWithdrawal.>",
      this.authService.useUnverifiedPublicIdentifier(this.getLatestWithdrawal.bind(this)),
    );

    // should move this at some point, this will probably move to be an HTTP endpoint
    await super.connectRequestReponse("config.get", this.getConfig.bind(this));
  }
}

export const channelProviderFactory: FactoryProvider<Promise<void>> = {
  inject: [
    AuthService,
    LoggerService,
    MessagingProviderId,
    ChannelService,
    CFCoreService,
    ChannelRepository,
    OnchainTransactionRepository,
    WithdrawService,
  ],
  provide: ChannelMessagingProviderId,
  useFactory: async (
    authService: AuthService,
    log: LoggerService,
    messaging: IMessagingService,
    channelService: ChannelService,
    cfCore: CFCoreService,
    channelRepo: ChannelRepository,
    onchain: OnchainTransactionRepository,
    withdrawService: WithdrawService,
  ): Promise<void> => {
    const channel = new ChannelMessaging(
      authService,
      channelRepo,
      channelService,
      withdrawService,
      cfCore,
      onchain,
      log,
      messaging,
    );
    await channel.setupSubscriptions();
  },
};
