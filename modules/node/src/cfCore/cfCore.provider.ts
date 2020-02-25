import { IMessagingService, MessagingServiceFactory } from "@connext/messaging";
import { CF_PATH, ConnextNodeStorePrefix } from "@connext/types";
import { Provider } from "@nestjs/common";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { fromMnemonic } from "ethers/utils/hdnode";

import { ConfigService } from "../config/config.service";
import { CFCoreProviderId, MessagingProviderId } from "../constants";
import { LockService } from "../lock/lock.service";
import { LoggerService } from "../logger/logger.service";
import { CFCore } from "../util/cfCore";

import { CFCoreRecordRepository } from "./cfCore.repository";

export const cfCoreProviderFactory: Provider = {
  inject: [ConfigService, LockService, LoggerService, MessagingProviderId, CFCoreRecordRepository],
  provide: CFCoreProviderId,
  useFactory: async (
    config: ConfigService,
    lockService: LockService,
    log: LoggerService,
    messaging: IMessagingService,
    store: CFCoreRecordRepository,
  ): Promise<CFCore> => {
    const hdNode = fromMnemonic(config.getMnemonic()).derivePath(CF_PATH);
    const publicExtendedKey = hdNode.neuter().extendedKey;
    const provider = config.getEthProvider();
    log.info(`Derived xpub from mnemonic: ${publicExtendedKey}`);

    // test that provider works
    const { chainId, name: networkName } = await config.getEthNetwork();
    const cfCore = await CFCore.create(
      messaging as any, // TODO: FIX
      store,
      await config.getContractAddresses(),
      { STORE_KEY_PREFIX: ConnextNodeStorePrefix },
      provider,
      { acquireLock: lockService.lockedOperation.bind(lockService) },
      publicExtendedKey,
      // key gen fn
      (uniqueId: string): Promise<string> => {
        return Promise.resolve(hdNode.derivePath(uniqueId).privateKey);
      },
    );
    const signerAddr = await cfCore.signerAddress();
    const balance = (await provider.getBalance(signerAddr)).toString();
    log.info(
      `Balance of signer address ${signerAddr} on ${networkName} (chainId ${chainId}): ${balance}`,
    );
    log.info("CFCore created");
    log.info(`Public Identifier ${JSON.stringify(cfCore.publicIdentifier)}`);
    log.info(`Free balance address ${cfCore.freeBalanceAddress}`);
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
