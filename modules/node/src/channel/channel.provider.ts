import { IMessagingService } from "@connext/messaging";
import { GetChannelResponse, GetConfigResponse, RequestCollateralResponse } from "@connext/types";
import { Node } from "@counterfactual/node";
import { Node as NodeTypes } from "@counterfactual/types";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { bigNumberify, getAddress } from "ethers/utils";

import { ConfigService } from "../config/config.service";
import { ChannelMessagingProviderId, MessagingProviderId, NodeProviderId } from "../constants";
import { PaymentProfile } from "../paymentProfile/paymentProfile.entity";
import { AbstractMessagingProvider } from "../util";

import { ChannelRepository } from "./channel.repository";
import { ChannelService } from "./channel.service";

// This should be done in the config module but i didnt want to create a circular dependency
class ConfigMessaging extends AbstractMessagingProvider {
  constructor(
    messaging: IMessagingService,
    private readonly node: Node,
    private readonly configService: ConfigService,
  ) {
    super(messaging);
  }

  async getConfig(): Promise<GetConfigResponse> {
    return {
      contractAddresses: await this.configService.getContractAddresses(),
      ethNetwork: await this.configService.getEthNetwork(),
      messaging: this.configService.getMessagingConfig(),
      nodePublicIdentifier: this.node.publicIdentifier,
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

  async createChannel(subject: string): Promise<NodeTypes.CreateChannelResult> {
    const pubId = this.getPublicIdentifierFromSubject(subject);
    return await this.channelService.create(pubId);
  }

  async requestCollateral(
    subject: string,
    data: { assetId?: string },
  ): Promise<RequestCollateralResponse> {
    const pubId = this.getPublicIdentifierFromSubject(subject);
    return this.channelService.requestCollateral(pubId, getAddress(data.assetId));
  }

  async addPaymentProfile(
    subject: string,
    data: {
      tokenAddress: string;
      minimumMaintainedCollateral: string;
      amountToCollateralize: string;
    },
  ): Promise<PaymentProfile> {
    const pubId = this.getPublicIdentifierFromSubject(subject);
    return await this.channelService.addPaymentProfileToChannel(
      pubId,
      getAddress(data.tokenAddress),
      bigNumberify(data.minimumMaintainedCollateral),
      bigNumberify(data.amountToCollateralize),
    );
  }

  setupSubscriptions(): void {
    super.connectRequestReponse("channel.get.>", this.getChannel.bind(this));
    super.connectRequestReponse("channel.create.>", this.createChannel.bind(this));
    super.connectRequestReponse("channel.request-collateral.>", this.requestCollateral.bind(this));
    super.connectRequestReponse("channel.add-profile.>", this.addPaymentProfile.bind(this));
  }
}

export const channelProviderFactory: FactoryProvider<Promise<void>> = {
  inject: [MessagingProviderId, ChannelRepository, ConfigService, NodeProviderId, ChannelService],
  provide: ChannelMessagingProviderId,
  useFactory: async (
    messaging: IMessagingService,
    channelRepo: ChannelRepository,
    configService: ConfigService,
    node: Node,
    channelService: ChannelService,
  ): Promise<void> => {
    const channel = new ChannelMessaging(messaging, channelRepo, channelService);
    await channel.setupSubscriptions();
    const config = new ConfigMessaging(messaging, node, configService);
    await config.setupSubscriptions();
  },
};
