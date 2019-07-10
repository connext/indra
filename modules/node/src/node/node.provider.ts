import { IMessagingService, MessagingServiceFactory } from "@connext/messaging";
import { MNEMONIC_PATH, Node } from "@counterfactual/node";
import { PostgresServiceFactory } from "@counterfactual/postgresql-node-connector";
import { Provider } from "@nestjs/common";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { ethers as eth } from "ethers";
import { Payload } from "ts-nats";

import { ConfigService } from "../config/config.service";
import { NatsProviderId, NodeProviderId, PostgresProviderId } from "../constants";
import { CLogger } from "../util";

const logger = new CLogger("NodeProvider");

async function createNode(
  config: ConfigService,
  natsMessagingService: IMessagingService,
  postgresServiceFactory: PostgresServiceFactory,
): Promise<Node> {
  logger.log("Creating store");
  const store = postgresServiceFactory.createStoreService("connextHub");
  logger.log("Store created");

  logger.log(`Creating Node with mnemonic: ${config.getMnemonic()}`);
  await store.set([{ key: MNEMONIC_PATH, value: config.getMnemonic() }]);

  // test that provider works
  const { chainId, name: networkName } = await config.getEthNetwork();
  const addr = eth.Wallet.fromMnemonic(config.getMnemonic(), "m/44'/60'/0'/25446").address;
  const provider = config.getEthProvider();
  const balance = (await provider.getBalance(addr)).toString();
  logger.log(
    `Balance of signer address ${addr} on ${networkName} (chainId ${chainId}): ${balance}`,
  );
  const node = await Node.create(
    natsMessagingService,
    store,
    { STORE_KEY_PREFIX: "store" },
    provider,
    await config.getContractAddresses(),
  );
  logger.log("Node created");
  logger.log(`Public Identifier ${JSON.stringify(node.publicIdentifier)}`);
  logger.log(
    `Free balance address ${JSON.stringify(
      eth.utils.HDNode.fromExtendedKey(node.publicIdentifier).derivePath("0").address,
    )}`,
  );
  return node;
}

export const nodeProvider: Provider = {
  inject: [ConfigService, NatsProviderId, PostgresProviderId],
  provide: NodeProviderId,
  useFactory: async (
    config: ConfigService,
    nats: IMessagingService,
    postgres: PostgresServiceFactory,
  ): Promise<Node> => {
    return await createNode(config, nats, postgres);
  },
};

// TODO: bypass factory
export const postgresProvider: Provider = {
  inject: [ConfigService],
  provide: PostgresProviderId,
  useFactory: async (config: ConfigService): Promise<PostgresServiceFactory> => {
    const pg = new PostgresServiceFactory({
      ...config.getPostgresConfig(),
      type: "postgres",
    });
    await pg.connectDb();
    return pg;
  },
};

// TODO: bypass factory
export const natsProvider: FactoryProvider<Promise<IMessagingService>> = {
  inject: [ConfigService],
  provide: NatsProviderId,
  useFactory: async (config: ConfigService): Promise<IMessagingService> => {
    const messagingService = new MessagingServiceFactory({
      payload: Payload.JSON,
      ...config.getNatsConfig(),
    }).createService("messaging");
    await messagingService.connect();
    return messagingService;
  },
};
