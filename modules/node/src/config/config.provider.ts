import { NatsMessagingService } from "@connext/nats-messaging-client";
import { Node } from "@counterfactual/node";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { Client } from "ts-nats";

import {
  ConfigMessagingProviderId,
  NatsProviderId,
  NodeProviderId,
} from "../constants";
import { BaseNatsProvider } from "../util/nats";

import { ConfigService } from "./config.service";

export type GetConfigResponse = {
  ethNetwork: string;
  ethUrl: string;
  nodePublicIdentifier: string;
  clusterId?: string;
  servers: string[];
  token?: string;
};

export class ConfigNats extends BaseNatsProvider {
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
}

export const channelProvider: FactoryProvider<Promise<Client>> = {
  inject: [NatsProviderId, NodeProviderId, ConfigService],
  provide: ConfigMessagingProviderId,
  useFactory: async (
    nats: NatsMessagingService,
    node: Node,
    config: ConfigService,
  ): Promise<Client> => {
    const client = nats.getConnection();
    const channel = new ConfigNats(client, node, config);
    await channel.setupSubscriptions();
    return client;
  },
};
