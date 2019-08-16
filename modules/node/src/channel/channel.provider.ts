import { IMessagingService } from "@connext/messaging";
import {
  convert,
  GetChannelResponse,
  GetConfigResponse,
  PaymentProfile as PaymentProfileRes,
  RequestCollateralResponse,
} from "@connext/types";
import { Node } from "@counterfactual/node";
import { Node as NodeTypes } from "@counterfactual/types";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { TransactionResponse } from "ethers/providers";
import { bigNumberify, getAddress } from "ethers/utils";

import { ConfigService } from "../config/config.service";
import { ChannelMessagingProviderId, MessagingProviderId, NodeProviderId } from "../constants";
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
    // do not allow clients to specify an amount to
    // collateralize with
    return this.channelService.requestCollateral(pubId, getAddress(data.assetId));
  }

  async withdraw(
    subject: string,
    data: { tx: NodeTypes.MinimalTransaction },
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

  setupSubscriptions(): void {
    super.connectRequestReponse("channel.get.>", this.getChannel.bind(this));
    super.connectRequestReponse("channel.create.>", this.createChannel.bind(this));
    super.connectRequestReponse("channel.request-collateral.>", this.requestCollateral.bind(this));
    super.connectRequestReponse("channel.withdraw.>", this.withdraw.bind(this));
    super.connectRequestReponse("channel.add-profile.>", this.addPaymentProfile.bind(this));
    super.connectRequestReponse("channel.get-profile.>", this.getPaymentProfile.bind(this));
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
