import { IMessagingService } from "@connext/nats-messaging-client";
import {
  CreateChannelResponse,
  GetChannelResponse,
  GetConfigResponse,
  RequestCollateralResponse,
} from "@connext/types";
import { Node } from "@counterfactual/node";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { RpcException } from "@nestjs/microservices";
import { Client } from "ts-nats";

import { ConfigService } from "../config/config.service";
import { ChannelMessagingProviderId, NatsProviderId, NodeProviderId } from "../constants";
import { AbstractNatsProvider } from "../util/nats";
import { isXpub } from "../validator/isXpub";

import { ChannelRepository } from "./channel.repository";
import { ChannelService } from "./channel.service";

export class ChannelNats extends AbstractNatsProvider {
  constructor(
    natsClient: Client,
    private readonly channelRepository: ChannelRepository,
    private readonly channelService: ChannelService,
  ) {
    super(natsClient);
  }

  async getChannel(subject: string): Promise<GetChannelResponse> {
    const pubId = this.getPublicIdentifierFromSubject(subject);
    return (await this.channelRepository.findByUserPublicIdentifier(pubId)) as GetChannelResponse;
  }

  async createChannel(subject: string): Promise<CreateChannelResponse> {
    const pubId = this.getPublicIdentifierFromSubject(subject);
    return await this.channelService.create(pubId);
  }

  async requestCollateral(subject: string): Promise<RequestCollateralResponse> {
    const pubId = this.getPublicIdentifierFromSubject(subject);
    return await this.channelService.requestCollateral(pubId);
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
export class ConfigNats extends AbstractNatsProvider {
  constructor(
    client: Client,
    private readonly node: Node,
    private readonly configService: ConfigService,
  ) {
    super(client);
  }

  async getConfig(): Promise<GetConfigResponse> {
    return {
      contractAddresses: await this.configService.getContractAddresses(),
      ethNetwork: await this.configService.getEthNetwork(),
      nodePublicIdentifier: this.node.publicIdentifier,
      ...this.configService.getNatsConfig(),
    };
  }

  setupSubscriptions(): void {
    super.connectRequestReponse("config.get", this.getConfig.bind(this));
  }
}

// TODO: reduce this boilerplate
export const channelProvider: FactoryProvider<Promise<Client>> = {
  inject: [NatsProviderId, ChannelRepository, ConfigService, NodeProviderId, ChannelService],
  provide: ChannelMessagingProviderId,
  useFactory: async (
    nats: IMessagingService,
    channelRepo: ChannelRepository,
    configService: ConfigService,
    node: Node,
    channelService: ChannelService,
  ): Promise<Client> => {
    const client = nats.getConnection();
    const channel = new ChannelNats(client, channelRepo, channelService);
    await channel.setupSubscriptions();
    const config = new ConfigNats(client, node, configService);
    await config.setupSubscriptions();
    return client;
  },
};
