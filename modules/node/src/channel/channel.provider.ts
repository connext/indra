import { NatsMessagingService } from "@connext/nats-messaging-client";
import { Node } from "@counterfactual/node";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { Client } from "ts-nats";

import { ConfigService } from "../config/config.service";
import { ChannelMessagingProviderId, NatsProviderId, NodeProviderId } from "../constants";
import { User } from "../user/user.entity";
import { UserRepository } from "../user/user.repository";
import { AbstractNatsProvider } from "../util/nats";

import { ChannelService } from "./channel.service";
import { RpcException } from "@nestjs/microservices";

export class ChannelNats extends AbstractNatsProvider {
  constructor(
    natsClient: Client,
    private readonly userRepo: UserRepository,
    private readonly channelService: ChannelService,
  ) {
    super(natsClient);
  }

  // TODO: change return type to channel view entity
  // TODO: validation
  async getChannel(subject: string): Promise<User> {
    const xpub = subject.split(".").pop(); // last item of subscription is xpub
    return await this.userRepo.findByXpub(xpub);
  }

  async createChannel(subject: string): Promise<User> {
    const xpub = subject.split(".").pop(); // last item of subscription is xpub
    console.log("xpub: ", xpub);
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
  inject: [NatsProviderId, UserRepository, ConfigService, NodeProviderId, ChannelService],
  provide: ChannelMessagingProviderId,
  useFactory: async (
    nats: NatsMessagingService,
    userRepo: UserRepository,
    configService: ConfigService,
    node: Node,
    channelService: ChannelService,
  ): Promise<Client> => {
    const client = nats.getConnection();
    const channel = new ChannelNats(client, userRepo, channelService);
    await channel.setupSubscriptions();
    const config = new ConfigNats(client, node, configService);
    await config.setupSubscriptions();
    return client;
  },
};
