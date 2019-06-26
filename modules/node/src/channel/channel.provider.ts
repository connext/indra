import { NatsMessagingService } from "@connext/nats-messaging-client";
import { CreateChannelResponse, GetChannelResponse, GetConfigResponse } from "@connext/types";
import { Node } from "@counterfactual/node";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { RpcException } from "@nestjs/microservices";
import { Client } from "ts-nats";

import { ConfigService } from "../config/config.service";
import { ChannelMessagingProviderId, NatsProviderId, NodeProviderId } from "../constants";
import { AbstractNatsProvider } from "../util/nats";

import { NodeChannelRepository } from "./channel.repository";
import { ChannelService } from "./channel.service";

export class ChannelNats extends AbstractNatsProvider {
  constructor(
    natsClient: Client,
    private readonly nodeChannelRepo: NodeChannelRepository,
    private readonly channelService: ChannelService,
  ) {
    super(natsClient);
  }

  // TODO: validation
  async getChannel(subject: string): Promise<GetChannelResponse> {
    const pubId = subject.split(".").pop(); // last item of subscription is pubId
    return (await this.nodeChannelRepo.findByPublicIdentifier(pubId)) as GetChannelResponse;
  }

  async createChannel(subject: string): Promise<CreateChannelResponse> {
    const pubId = subject.split(".").pop(); // last item of subscription is pubId
    try {
      return await this.channelService.create(pubId);
    } catch (e) {
      throw new RpcException(`Error calling createChannel RPC method `);
    }
  }

  setupSubscriptions(): void {
    super.connectRequestReponse("channel.get.>", this.getChannel.bind(this));

    super.connectRequestReponse("channel.create.>", this.createChannel.bind(this));
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

  // TODO: Should this be in a config controller instead?
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
  inject: [NatsProviderId, NodeChannelRepository, ConfigService, NodeProviderId, ChannelService],
  provide: ChannelMessagingProviderId,
  useFactory: async (
    nats: NatsMessagingService,
    nodeChannelRepo: NodeChannelRepository,
    configService: ConfigService,
    node: Node,
    channelService: ChannelService,
  ): Promise<Client> => {
    const client = nats.getConnection();
    const channel = new ChannelNats(client, nodeChannelRepo, channelService);
    await channel.setupSubscriptions();
    const config = new ConfigNats(client, node, configService);
    await config.setupSubscriptions();
    return client;
  },
};
