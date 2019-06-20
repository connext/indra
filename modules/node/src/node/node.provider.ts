import {
  NatsMessagingService,
  NatsServiceFactory,
} from "@connext/nats-messaging-client";
import { MNEMONIC_PATH, Node } from "@counterfactual/node";
import { PostgresServiceFactory } from "@counterfactual/postgresql-node-connector";
import { Provider } from "@nestjs/common";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { JsonRpcProvider } from "ethers/providers";

import { ConfigService } from "../config/config.service";
import {
  NatsProviderId,
  NodeProviderId,
  PostgresProviderId,
} from "../constants";
import { CLogger } from "../util";

const logger = new CLogger("NodeProvider");

async function createNode(
  config: ConfigService,
  natsMessagingService: NatsMessagingService,
  postgresServiceFactory: PostgresServiceFactory,
): Promise<Node> {
  logger.log("Creating store");
  const store = postgresServiceFactory.createStoreService("connextHub");
  logger.log("Store created");

  logger.log("Creating Node");
  const { ethUrl, ethNetwork } = config.getEthProviderConfig();
  const node = await Node.create(
    natsMessagingService,
    store,
    { STORE_KEY_PREFIX: "store" },
    new JsonRpcProvider(ethUrl) as any, // FIXME
    ethNetwork, // Node should probably accept a chainId instead..
  );
  logger.log("Node created");

  logger.log(`Public Identifier ${JSON.stringify(node.publicIdentifier)}`);

  return node;
}

export const nodeProvider: Provider = {
  inject: [ConfigService, NatsProviderId, PostgresProviderId],
  provide: NodeProviderId,
  useFactory: async (
    config: ConfigService,
    nats: NatsMessagingService,
    postgres: PostgresServiceFactory,
  ): Promise<Node> => {
    return await createNode(config, nats, postgres);
  },
};

// TODO: bypass factory
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

// TODO: bypass factory
export const natsProvider: FactoryProvider<Promise<NatsMessagingService>> = {
  inject: [ConfigService],
  provide: NatsProviderId,
  useFactory: async (config: ConfigService): Promise<NatsMessagingService> => {
    const natsServiceFactory = new NatsServiceFactory({
      servers: config.getNatsConfig().servers,
    });
    const messService = natsServiceFactory.createMessagingService("messaging");
    await messService.connect();
    return messService;
  },
};
