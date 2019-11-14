import { IMessagingService, MessagingServiceFactory } from "@connext/messaging";
import { ConnextNodeStorePrefix } from "@connext/types";
import { Provider } from "@nestjs/common";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { fromMnemonic } from "ethers/utils/hdnode";

import { ConfigService } from "../config/config.service";
import { CFCoreProviderId, CF_PATH, MessagingProviderId } from "../constants";
import { LockService } from "../lock/lock.service";
import { CLogger, xpubToAddress } from "../util";
import { CFCore } from "../util/cfCore";

import { CFCoreRecordRepository } from "./cfCore.repository";

const logger = new CLogger("CFCoreProvider");

export const cfCoreProviderFactory: Provider = {
  inject: [ConfigService, MessagingProviderId, CFCoreRecordRepository, LockService],
  provide: CFCoreProviderId,
  useFactory: async (
    config: ConfigService,
    messaging: IMessagingService,
    store: CFCoreRecordRepository,
    lockService: LockService,
  ): Promise<CFCore> => {
    const hdNode = fromMnemonic(config.getMnemonic()).derivePath(CF_PATH);
    const publicExtendedKey = hdNode.neuter().extendedKey;
    const provider = config.getEthProvider();
    logger.log(`Derived xpub from mnemonic: ${publicExtendedKey}`);

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
    const signerAddr = xpubToAddress(cfCore.publicIdentifier);
    const balance = (await provider.getBalance(signerAddr)).toString();
    logger.log(
      `Balance of signer address ${signerAddr} on ${networkName} (chainId ${chainId}): ${balance}`,
    );
    logger.log("CFCore created");
    logger.log(`Public Identifier ${JSON.stringify(cfCore.publicIdentifier)}`);
    logger.log(`Free balance address ${xpubToAddress(cfCore.publicIdentifier)}`);
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
