import { NatsMessagingService, NatsServiceFactory } from "@connext/nats-messaging-client";
import { MNEMONIC_PATH, Node } from "@counterfactual/node";
import { PostgresServiceFactory } from "@counterfactual/postgresql-node-connector";
import { NetworkContext } from "@counterfactual/types";
import { Provider } from "@nestjs/common";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { ethers } from "ethers";
import { JsonRpcProvider } from "ethers/providers";

// import * as addressBook from "../address-book.json";
import { ConfigService } from "../config/config.service";
import { NatsProviderId, NodeProviderId, PostgresProviderId } from "../constants";
import { CLogger } from "../util";

const logger = new CLogger("NodeProvider");

const coreContracts = [
  "ChallengeRegistry",
  "ETHBalanceRefundApp",
  "ETHBucket",
  "ETHInterpreter",
  "MinimumViableMultisig",
  "MultiSend",
  "ProxyFactory",
  "RootNonceRegistry",
  "StateChannelTransaction",
  "TwoPartyEthAsLump",
  "TwoPartyVirtualEthAsLump",
  "UninstallKeyRegistry",
];

async function createNode(
  config: ConfigService,
  natsMessagingService: NatsMessagingService,
  postgresServiceFactory: PostgresServiceFactory,
): Promise<Node> {
  logger.log("Creating store");
  const store = postgresServiceFactory.createStoreService("connextHub");
  logger.log("Store created");

  logger.log(`Creating Node with mnemonic: ${config.getMnemonic()}`);
  const addr = ethers.utils.HDNode.fromMnemonic(config.getMnemonic()).derivePath(
    "m/44'/60'/0'/25446",
  ).address;

  await store.set([{ key: MNEMONIC_PATH, value: config.getMnemonic() }]);

  const { ethUrl, ethNetwork } = config.getEthProviderConfig();

  logger.log(
    `Creating Node with eth env: ${JSON.stringify({
      ethNetwork,
      ethUrl,
    })}`,
  );

  // test that provider works
  const provider = new JsonRpcProvider(ethUrl);
  const balance = await provider.getBalance(addr);
  logger.log(`Balance of address: ${balance.toString()}`);

  // let network: object | string;
  // if (ethNetwork === "ganache") {
  //   network = {};
  //   const networkId = "4447";
  //   coreContracts.forEach((contractName: string): void => {
  //     if (
  //       addressBook[contractName] &&
  //       addressBook[contractName].networks[networkId]
  //     ) {
  //       network[contractName] =
  //         addressBook[contractName].networks[networkId].address;
  //     } else {
  //       console.log(
  //         `This contract: ${JSON.stringify(addressBook[contractName])}`,
  //       );
  //       throw new Error(
  //         `Contract ${contractName} hasn't been deployed to network ${networkId}`,
  //       );
  //     }
  //   });
  // } else {
  //   network = ethNetwork;
  // }

  const network = ethNetwork;

  const node = await Node.create(
    natsMessagingService,
    store,
    { STORE_KEY_PREFIX: "store" },
    provider,
    network as string | NetworkContext,
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
