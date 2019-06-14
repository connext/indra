import { NatsServiceFactory } from "@connext/nats-messaging-client";
import { MNEMONIC_PATH, Node } from "@counterfactual/node";
import { PostgresServiceFactory } from "@counterfactual/postgresql-node-connector";
import { Logger, Provider } from "@nestjs/common";
import { JsonRpcProvider } from "ethers/providers";

import { ConfigService } from "../config/config.service";
import {
  NatsProviderId,
  NodeProviderId,
  PostgresProviderId,
} from "../constants";

async function createNode(
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

  Logger.log(
    `Public Identifier ${JSON.stringify(node.publicIdentifier)}`,
    "NodeProvider",
  );

  return node;
}

export const nodeProvider: Provider = {
  inject: [ConfigService, NatsProviderId, PostgresProviderId],
  provide: NodeProviderId,
  useFactory: async (
    config: ConfigService,
    nats: NatsServiceFactory,
    postgres: PostgresServiceFactory,
  ): Promise<Node> => {
    return await createNode(config, nats, postgres);
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
