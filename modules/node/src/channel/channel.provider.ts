import { IMessagingService } from "@connext/messaging";
import {
  CreateChannelResponse,
  GetChannelResponse,
  GetConfigResponse,
  RequestCollateralResponse,
} from "@connext/types";
import { Node } from "@counterfactual/node";
import { Node as NodeTypes } from "@counterfactual/types";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { RpcException } from "@nestjs/microservices";

import { ConfigService } from "../config/config.service";
import { ChannelMessagingProviderId, MessagingProviderId, NodeProviderId } from "../constants";
import { AbstractMessagingProvider } from "../util/messaging";
import { isXpub } from "../validator/isXpub";

import { ChannelRepository } from "./channel.repository";
import { ChannelService } from "./channel.service";

export class ChannelMessaging extends AbstractMessagingProvider {
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
    data: { tokenAddress?: string },
  ): Promise<RequestCollateralResponse> {
    // TODO: add validation
    const pubId = this.getPublicIdentifierFromSubject(subject);
    return this.channelService.requestCollateral(pubId, data.tokenAddress);
  }

  setupSubscriptions(): void {
    super.connectRequestReponse("channel.get.>", this.getChannel.bind(this));

    super.connectRequestReponse("channel.create.>", this.createChannel.bind(this));

    super.connectRequestReponse("channel.request-collateral.>", this.requestCollateral.bind(this));
  }

  private getPublicIdentifierFromSubject(subject: string): string {
    const pubId = subject.split(".").pop(); // last item of subscription is pubId
    if (!pubId || !isXpub(pubId)) {
      throw new RpcException("Invalid public identifier in message subject");
    }
    return pubId;
  }
}

// this should be done in the config module but i didnt want to create a circular dependency
export class ConfigMessaging extends AbstractMessagingProvider {
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

// TODO: reduce this boilerplate
export const channelProvider: FactoryProvider<Promise<IMessagingService>> = {
  inject: [MessagingProviderId, ChannelRepository, ConfigService, NodeProviderId, ChannelService],
  provide: ChannelMessagingProviderId,
  useFactory: async (
    messaging: IMessagingService,
    channelRepo: ChannelRepository,
    configService: ConfigService,
    node: Node,
    channelService: ChannelService,
  ): Promise<IMessagingService> => {
    const channel = new ChannelMessaging(messaging, channelRepo, channelService);
    await channel.setupSubscriptions();
    const config = new ConfigMessaging(messaging, node, configService);
    await config.setupSubscriptions();
    return messaging;
  },
};
