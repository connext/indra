import { IMessagingService } from "@connext/messaging";
import {
  ChannelAppSequences,
  GetChannelResponse,
  GetConfigResponse,
  StateChannelJSON,
  RebalanceProfile,
  convert,
} from "@connext/types";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { TransactionResponse } from "ethers/providers";
import { getAddress } from "ethers/utils";

import { AuthService } from "../auth/auth.service";
import { ConfigService } from "../config/config.service";
import { LoggerService } from "../logger/logger.service";
import { CFCoreProviderId, ChannelMessagingProviderId, MessagingProviderId } from "../constants";
import { OnchainTransaction } from "../onchainTransactions/onchainTransaction.entity";
import { AbstractMessagingProvider } from "../util";
import { CFCore, CFCoreTypes } from "../util/cfCore";

import { ChannelRepository } from "./channel.repository";
import { ChannelService, RebalanceType } from "./channel.service";

// This should be done in the config module but i didnt want to create a circular dependency
class ConfigMessaging extends AbstractMessagingProvider {
  constructor(
    private readonly cfCore: CFCore,
    private readonly configService: ConfigService,
    logger: LoggerService,
    messaging: IMessagingService,
  ) {
    super(logger, messaging);
  }

  async getConfig(): Promise<GetConfigResponse> {
    return {
      contractAddresses: await this.configService.getContractAddresses(),
      ethNetwork: await this.configService.getEthNetwork(),
      messaging: this.configService.getMessagingConfig(),
      nodePublicIdentifier: this.cfCore.publicIdentifier,
    };
  }

  async setupSubscriptions(): Promise<void> {
    super.connectRequestReponse("config.get", this.getConfig.bind(this));
  }
}

class ChannelMessaging extends AbstractMessagingProvider {
  constructor(
    private readonly authService: AuthService,
    private readonly channelRepository: ChannelRepository,
    private readonly channelService: ChannelService,
    logger: LoggerService,
    messaging: IMessagingService,
  ) {
    super(logger, messaging);
  }

  async getChannel(pubId: string, data?: unknown): Promise<GetChannelResponse> {
    return (await this.channelRepository.findByUserPublicIdentifier(pubId)) as GetChannelResponse;
  }

  async createChannel(pubId: string): Promise<CFCoreTypes.CreateChannelResult> {
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
  ): Promise<CFCoreTypes.DepositResult> {
    // do not allow clients to specify an amount to collateralize with
    return (await (this.channelService.rebalance(
      pubId,
      getAddress(data.assetId),
      RebalanceType.COLLATERALIZE,
    ) as unknown)) as CFCoreTypes.DepositResult;
  }

  async withdraw(
    pubId: string,
    data: { tx: CFCoreTypes.MinimalTransaction },
  ): Promise<TransactionResponse> {
    return await this.channelService.withdrawForClient(pubId, data.tx);
  }

  async addRebalanceProfile(pubId: string, data: { profile: RebalanceProfile }): Promise<void> {
    const profile = convert.RebalanceProfile("bignumber", data.profile);
    await this.channelService.addRebalanceProfileToChannel(pubId, profile);
  }

  async getRebalanceProfile(
    pubId: string,
    data: { assetId?: string },
  ): Promise<RebalanceProfile | undefined> {
    const prof = await this.channelRepository.getRebalanceProfileForChannelAndAsset(
      pubId,
      data.assetId,
    );

    if (!prof) {
      return undefined;
    }

    const {
      upperBoundReclaim,
      lowerBoundReclaim,
      upperBoundCollateralize,
      lowerBoundCollateralize,
      assetId,
    } = prof;
    return convert.RebalanceProfile("str", {
      assetId,
      lowerBoundCollateralize,
      lowerBoundReclaim,
      upperBoundCollateralize,
      upperBoundReclaim,
    });
  }

  async getLatestWithdrawal(pubId: string, data: {}): Promise<OnchainTransaction | undefined> {
    const onchainTx = await this.channelService.getLatestWithdrawal(pubId);
    // TODO: conversions needed?
    return onchainTx;
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
      "channel.withdraw.>",
      this.authService.useUnverifiedPublicIdentifier(this.withdraw.bind(this)),
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
  }
}

export const channelProviderFactory: FactoryProvider<Promise<void>> = {
  inject: [
    AuthService,
    CFCoreProviderId,
    ChannelRepository,
    ChannelService,
    ConfigService,
    LoggerService,
    MessagingProviderId,
  ],
  provide: ChannelMessagingProviderId,
  useFactory: async (
    authService: AuthService,
    cfCore: CFCore,
    channelRepo: ChannelRepository,
    channelService: ChannelService,
    configService: ConfigService,
    logger: LoggerService,
    messaging: IMessagingService,
  ): Promise<void> => {
    const channel = new ChannelMessaging(
      authService,
      channelRepo,
      channelService,
      logger,
      messaging,
    );
    await channel.setupSubscriptions();
    const config = new ConfigMessaging(cfCore, configService, logger, messaging);
    await config.setupSubscriptions();
  },
};
