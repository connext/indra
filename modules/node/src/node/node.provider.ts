import { NatsServiceFactory } from "@connext/nats-messaging-client";
import {
  CreateChannelMessage,
  DepositConfirmationMessage,
  MNEMONIC_PATH,
  Node,
} from "@counterfactual/node";
import { PostgresServiceFactory } from "@counterfactual/postgresql-node-connector";
import { Node as NodeTypes } from "@counterfactual/types";
import { Logger, Provider, forwardRef } from "@nestjs/common";
import { JsonRpcProvider } from "ethers/providers";

import { ChannelService } from "../channel/channel.service";
import { ConfigService } from "../config/config.service";
import {
  NatsProviderId,
  NodeProviderId,
  PostgresProviderId,
} from "../constants";

async function createNode(
  channelService: ChannelService,
  config: ConfigService,
  natsServiceFactory: NatsServiceFactory,
  postgresServiceFactory: PostgresServiceFactory,
): Promise<Node> {
  // TODO: make this logging more dynamic?
  Logger.log("Creating store", "NodeProvider");
  const store = postgresServiceFactory.createStoreService("connextHub");
  Logger.log("Store created", "NodeProvider");

  // TODO: Maybe we shouldn't store the mnemonic in the db?
  await store.set([{ key: MNEMONIC_PATH, value: config.getMnemonic() }]);

  Logger.log("Creating Node", "NodeProvider");
  const { ethUrl, ethNetwork } = config.getEthProviderConfig();
  const messService = natsServiceFactory.createMessagingService("messaging");
  await messService.connect();
  const node = await Node.create(
    messService,
    store,
    { STORE_KEY_PREFIX: "store" },
    new JsonRpcProvider(ethUrl) as any, // FIXME
    ethNetwork, // Node should probably accept a chainId instead..
  );
  Logger.log("Node created", "NodeProvider");

  node.on(
    NodeTypes.EventName.DEPOSIT_CONFIRMED,
    (res: DepositConfirmationMessage) => {
      if (!res || !res.data) {
        return;
      }
      Logger.log(
        `Deposit detected: ${JSON.stringify(res)}, matching`,
        "NodeProvider",
      );
      channelService.deposit(
        res.data.multisigAddress,
        res.data.amount as any, // FIXME
        res.data.notifyCounterparty,
      );
    },
  );

  node.on(NodeTypes.EventName.CREATE_CHANNEL, (res: CreateChannelMessage) =>
    channelService.addMultisig(
      res.data.counterpartyXpub,
      res.data.multisigAddress,
    ),
  );

  Logger.log(
    `Public Identifier ${JSON.stringify(node.publicIdentifier)}`,
    "NodeProvider",
  );

  return node;
}

export const nodeProvider: Provider = {
  inject: [ChannelService, ConfigService, NatsProviderId, PostgresProviderId],
  provide: NodeProviderId,
  useFactory: async (
    channelService: ChannelService,
    config: ConfigService,
    nats: NatsServiceFactory,
    postgres: PostgresServiceFactory,
  ): Promise<Node> => {
    return await createNode(channelService, config, nats, postgres);
  },
};

export const postgresProvider: Provider = {
  inject: [ConfigService],
  provide: PostgresProviderId,
  useFactory: async (
    config: ConfigService,
  ): Promise<PostgresServiceFactory> => {
    const pg = new PostgresServiceFactory({
      ...config.getPostgresConfig(),
      type: "postgres",
    });
    await pg.connectDb();
    return pg;
  },
};

export const natsProvider: Provider = {
  inject: [ConfigService],
  provide: NatsProviderId,
  useFactory: (config: ConfigService): NatsServiceFactory => {
    return new NatsServiceFactory({ servers: config.getNatsConfig().servers });
  },
};
