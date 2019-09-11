import { IMessagingService, MessagingServiceFactory } from "@connext/messaging";
import { RedisLockService } from "@connext/redis-lock";
import { Provider } from "@nestjs/common";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { Wallet } from "ethers";
import { HDNode } from "ethers/utils";

import { ConfigService } from "../config/config.service";
import { CFCoreProviderId, MessagingProviderId } from "../constants";
import { CLogger, freeBalanceAddressFromXpub } from "../util";
import { CFCore, EXTENDED_PRIVATE_KEY_PATH } from "../util/cfCore";

import { CFCoreRecordRepository } from "./cfCore.repository";

const logger = new CLogger("CFCoreProvider");

export const cfCoreProviderFactory: Provider = {
  inject: [ConfigService, MessagingProviderId, CFCoreRecordRepository],
  provide: CFCoreProviderId,
  useFactory: async (
    config: ConfigService,
    messaging: IMessagingService,
    store: CFCoreRecordRepository,
  ): Promise<CFCore> => {
    // create redis lock servuce
    const lockService = new RedisLockService(config.getRedisUrl());

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
    const cfCore = await CFCore.create(
      messaging,
      store,
      lockService,
      { STORE_KEY_PREFIX: "ConnextHub" },
      provider,
      await config.getContractAddresses(),
    );
    logger.log("CFCore created");
    logger.log(`Public Identifier ${JSON.stringify(cfCore.publicIdentifier)}`);
    logger.log(
      `Free balance address ${JSON.stringify(freeBalanceAddressFromXpub(cfCore.publicIdentifier))}`,
    );
    return cfCore;
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
