import { IMessagingService, MessagingServiceFactory } from "@connext/messaging";
import { EXTENDED_PRIVATE_KEY_PATH, Node } from "@counterfactual/node";
import { Provider } from "@nestjs/common";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { Wallet } from "ethers";
import { HDNode } from "ethers/utils";

import { ConfigService } from "../config/config.service";
import { MessagingProviderId, NodeProviderId } from "../constants";
import { CLogger, freeBalanceAddressFromXpub } from "../util";

import { NodeRecordRepository } from "./node.repository";

const logger = new CLogger("NodeProvider");

export const nodeProviderFactory: Provider = {
  inject: [ConfigService, MessagingProviderId, NodeRecordRepository],
  provide: NodeProviderId,
  useFactory: async (
    config: ConfigService,
    messaging: IMessagingService,
    store: NodeRecordRepository,
  ): Promise<Node> => {
    await store.set([
      {
        path: EXTENDED_PRIVATE_KEY_PATH,
        value: HDNode.fromMnemonic(config.getMnemonic()).extendedKey,
      },
    ]);
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
      { STORE_KEY_PREFIX: "ConnextHub" },
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
