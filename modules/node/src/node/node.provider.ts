import { IMessagingService, MessagingServiceFactory } from "@connext/messaging";
import { MNEMONIC_PATH, Node } from "@counterfactual/node";
import { PostgresServiceFactory } from "@counterfactual/postgresql-node-connector";
import { Provider } from "@nestjs/common";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { Wallet } from "ethers";

import { ConfigService } from "../config/config.service";
import { MessagingProviderId, NodeProviderId, PostgresProviderId } from "../constants";
import { CLogger, freeBalanceAddressFromXpub } from "../util";

const logger = new CLogger("NodeProvider");

export const nodeProviderFactory: Provider = {
  inject: [ConfigService, MessagingProviderId, PostgresProviderId],
  provide: NodeProviderId,
  useFactory: async (
    config: ConfigService,
    messaging: IMessagingService,
    postgres: PostgresServiceFactory,
  ): Promise<Node> => {
    logger.log("Creating store");
    const store = postgres.createStoreService("connextHub");
    logger.log("Store created");
    logger.log(`Creating Node with mnemonic: ${config.getMnemonic()}`);
    await store.set([{ key: MNEMONIC_PATH, value: config.getMnemonic() }]);
    // test that provider works
    const { chainId, name: networkName } = await config.getEthNetwork();
    const addr = Wallet.fromMnemonic(config.getMnemonic(), "m/44'/60'/0'/25446").address;
    const provider = config.getEthProvider();
    const balance = (await provider.getBalance(addr)).toString();
    logger.log(
      `Balance of signer address ${addr} on ${networkName} (chainId ${chainId}): ${balance}`,
    );
    const node = await Node.create(
      messaging,
      store,
      { STORE_KEY_PREFIX: "store" },
      provider,
      await config.getContractAddresses(),
    );
    logger.log("Node created");
    logger.log(`Public Identifier ${JSON.stringify(node.publicIdentifier)}`);
    logger.log(
      `Free balance address ${JSON.stringify(freeBalanceAddressFromXpub(node.publicIdentifier))}`,
    );
    return node;
  },
};

// TODO: bypass factory
export const postgresProviderFactory: Provider = {
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
export const messagingProviderFactory: FactoryProvider<Promise<IMessagingService>> = {
  inject: [ConfigService],
  provide: MessagingProviderId,
  useFactory: async (config: ConfigService): Promise<IMessagingService> => {
    const messagingFactory = new MessagingServiceFactory(config.getMessagingConfig());
    const messagingService = messagingFactory.createService("messaging");
    await messagingService.connect();
    return messagingService;
  },
};
