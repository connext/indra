import { IMessagingService } from "@connext/messaging";
import {
  ChannelAppSequences,
  convert,
  GetChannelResponse,
  GetConfigResponse,
  PaymentProfile as PaymentProfileRes,
  RequestCollateralResponse,
} from "@connext/types";
import { Node as CFCoreTypes } from "@counterfactual/types";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { TransactionResponse } from "ethers/providers";
import { bigNumberify, getAddress } from "ethers/utils";

import { ConfigService } from "../config/config.service";
import { CFCoreProviderId, ChannelMessagingProviderId, MessagingProviderId } from "../constants";
import { AbstractMessagingProvider } from "../util";
import { CFCore } from "../util/cfCore";

import { ChannelRepository } from "./channel.repository";
import { ChannelService } from "./channel.service";

// This should be done in the config module but i didnt want to create a circular dependency
class ConfigMessaging extends AbstractMessagingProvider {
  constructor(
    messaging: IMessagingService,
    private readonly cfCore: CFCore,
    private readonly configService: ConfigService,
  ) {
    super(messaging);
  }

  async getConfig(): Promise<GetConfigResponse> {
    return {
      contractAddresses: await this.configService.getContractAddresses(),
      ethNetwork: await this.configService.getEthNetwork(),
      messaging: this.configService.getMessagingConfig(),
      nodePublicIdentifier: this.cfCore.publicIdentifier,
    };
  }

  setupSubscriptions(): void {
    super.connectRequestReponse("config.get", this.getConfig.bind(this));
  }
}

class ChannelMessaging extends AbstractMessagingProvider {
  constructor(
    messaging: IMessagingService,
    private readonly channelRepository: ChannelRepository,
    private readonly channelService: ChannelService,
  ) {
    super(messaging);
  }

  async getChannel(subject: string): Promise<GetChannelResponse> {
    const pubId = this.getPublicIdentifierFromSubject(subject);
    return (await this.channelRepository.findByUserPublicIdentifier(pubId)) as GetChannelResponse;
  }

  async createChannel(subject: string): Promise<CFCoreTypes.CreateChannelResult> {
    const pubId = this.getPublicIdentifierFromSubject(subject);
    return await this.channelService.create(pubId);
  }

  async verifyAppSequenceNumber(
    subject: string,
    data: { userAppSequenceNumber: number },
  ): Promise<ChannelAppSequences> {
    const userPubId = this.getPublicIdentifierFromSubject(subject);
    return await this.channelService.verifyAppSequenceNumber(userPubId, data.userAppSequenceNumber);
  }

  async requestCollateral(
    subject: string,
    data: { assetId?: string },
  ): Promise<RequestCollateralResponse> {
    const pubId = this.getPublicIdentifierFromSubject(subject);
    // do not allow clients to specify an amount to
    // collateralize with
    return this.channelService.requestCollateral(pubId, getAddress(data.assetId));
  }

  async withdraw(
    subject: string,
    data: { tx: CFCoreTypes.MinimalTransaction },
  ): Promise<TransactionResponse> {
    const pubId = this.getPublicIdentifierFromSubject(subject);
    return this.channelService.withdrawForClient(pubId, data.tx);
  }

  async addPaymentProfile(
    subject: string,
    data: {
      assetId: string;
      minimumMaintainedCollateral: string;
      amountToCollateralize: string;
    },
  ): Promise<PaymentProfileRes> {
    const pubId = this.getPublicIdentifierFromSubject(subject);
    const {
      amountToCollateralize,
      minimumMaintainedCollateral,
      assetId,
    } = await this.channelService.addPaymentProfileToChannel(
      pubId,
      data.assetId,
      bigNumberify(data.minimumMaintainedCollateral),
      bigNumberify(data.amountToCollateralize),
    );

    return convert.PaymentProfile("str", {
      amountToCollateralize,
      assetId,
      minimumMaintainedCollateral,
    });
  }

  async getPaymentProfile(
    subject: string,
    data: { assetId?: string },
  ): Promise<PaymentProfileRes | undefined> {
    const pubId = this.getPublicIdentifierFromSubject(subject);

    const prof = await this.channelRepository.getPaymentProfileForChannelAndToken(
      pubId,
      data.assetId,
    );

    if (!prof) {
      return undefined;
    }

    const { amountToCollateralize, minimumMaintainedCollateral, assetId } = prof;
    return convert.PaymentProfile("str", {
      amountToCollateralize,
      assetId,
      minimumMaintainedCollateral,
    });
  }

  async setupSubscriptions(): Promise<void> {
    await super.connectRequestReponse("channel.get.>", this.getChannel.bind(this));
    await super.connectRequestReponse("channel.create.>", this.createChannel.bind(this));
    await super.connectRequestReponse(
      "channel.request-collateral.>",
      this.requestCollateral.bind(this),
    );
    await super.connectRequestReponse("channel.withdraw.>", this.withdraw.bind(this));
    await super.connectRequestReponse("channel.add-profile.>", this.addPaymentProfile.bind(this));
    await super.connectRequestReponse("channel.get-profile.>", this.getPaymentProfile.bind(this));
    await super.connectRequestReponse(
      "channel.verify-app-sequence.>",
      this.verifyAppSequenceNumber.bind(this),
    );
  }
}

export const channelProviderFactory: FactoryProvider<Promise<void>> = {
  inject: [MessagingProviderId, ChannelRepository, ConfigService, CFCoreProviderId, ChannelService],
  provide: ChannelMessagingProviderId,
  useFactory: async (
    messaging: IMessagingService,
    channelRepo: ChannelRepository,
    configService: ConfigService,
    cfCore: CFCore,
    channelService: ChannelService,
  ): Promise<void> => {
    const channel = new ChannelMessaging(messaging, channelRepo, channelService);
    await channel.setupSubscriptions();
    const config = new ConfigMessaging(messaging, cfCore, configService);
    await config.setupSubscriptions();
  },
};
