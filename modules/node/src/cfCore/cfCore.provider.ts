import { IMessagingService, MessagingServiceFactory } from "@connext/messaging";
import { ConnextNodeStorePrefix } from "@connext/types";
import { Provider } from "@nestjs/common";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { Wallet } from "ethers";
import { fromExtendedKey, fromMnemonic } from "ethers/utils/hdnode";

import { ConfigService } from "../config/config.service";
import { CF_PATH, CFCoreProviderId, MessagingProviderId } from "../constants";
import { LockService } from "../lock/lock.service";
import { CLogger, freeBalanceAddressFromXpub } from "../util";
import { CFCore, EXTENDED_PRIVATE_KEY_PATH } from "../util/cfCore";

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
    const privateExtendedKey = fromMnemonic(config.getMnemonic()).extendedKey;
    const hdNode = fromExtendedKey(privateExtendedKey).derivePath(CF_PATH);
    const publicExtendedKey = hdNode.neuter().extendedKey;
    logger.log(`Derived xpub from mnemonic: ${publicExtendedKey}`);
    // test that provider works
    const { chainId, name: networkName } = await config.getEthNetwork();
    const signerAddr = hdNode.neuter().address;
    const provider = config.getEthProvider();
    const balance = (await provider.getBalance(signerAddr)).toString();
    logger.log(
      `Balance of signer address ${signerAddr} on ${networkName} (chainId ${chainId}): ${balance}`,
    );
    const cfCore = await CFCore.create(
      messaging, // TODO: FIX
      store,
      await config.getContractAddresses(),
      { STORE_KEY_PREFIX: ConnextNodeStorePrefix },
      provider,
      { acquireLock: lockService.lockedOperation.bind(lockService) },
      publicExtendedKey,
      (uniqueID: string): Promise<string> => {
        return Promise.resolve(hdNode.derivePath(uniqueID).privateKey);
      },
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
