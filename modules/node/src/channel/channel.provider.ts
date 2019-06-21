import { NatsMessagingService } from "@connext/nats-messaging-client";
import { Node } from "@counterfactual/node";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { RpcException } from "@nestjs/microservices";
import { Client } from "ts-nats";

import { ConfigService } from "../config/config.service";
import { ChannelMessagingProviderId, NatsProviderId, NodeProviderId } from "../constants";
import { User } from "../user/user.entity";
import { AbstractNatsProvider } from "../util/nats";

import { NodeChannel } from "./channel.entity";
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
  async getChannel(subject: string): Promise<NodeChannel> {
    const xpub = subject.split(".").pop(); // last item of subscription is xpub
    return await this.nodeChannelRepo.findByXpub(xpub);
  }

  async createChannel(subject: string): Promise<User> {
    const xpub = subject.split(".").pop(); // last item of subscription is xpub
    try {
      return await this.channelService.create(xpub);
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
export type GetConfigResponse = {
  ethNetwork: string;
  ethUrl: string;
  nodePublicIdentifier: string;
  clusterId?: string;
  servers: string[];
  token?: string;
};

export class ConfigNats extends AbstractNatsProvider {
  constructor(
    client: Client,
    private readonly node: Node,
    private readonly configService: ConfigService,
  ) {
    super(client);
  }

  getConfig(): GetConfigResponse {
    return {
      ...this.configService.getEthProviderConfig(),
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
