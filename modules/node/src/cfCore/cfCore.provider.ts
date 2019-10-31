import { IMessagingService, MessagingServiceFactory } from "@connext/messaging";
import { ConnextNodeStorePrefix } from "@connext/types";
import { Provider } from "@nestjs/common";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { fromMnemonic } from "ethers/utils/hdnode";

import { migrateToPatch1 } from "../cfCoreMigrations/patch1";
import { ConfigService } from "../config/config.service";
import { CF_PATH, CFCoreProviderId, MessagingProviderId } from "../constants";
import { LockService } from "../lock/lock.service";
import { CLogger, freeBalanceAddressFromXpub } from "../util";
import { CFCore } from "../util/cfCore";

import { CFCoreRecordRepository } from "./cfCore.repository";

const logger = new CLogger("CFCoreProvider");

// TODO: where should this live?
const LATEST_CF_STORE_VERSION = 1;

function isLatestCfStoreVersion(storeRecord: any): boolean {
  if (!storeRecord || storeRecord.version !== LATEST_CF_STORE_VERSION) {
    return false;
  }
  return true;
}

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

    // MIGRATE STORE IF NEEDED
    const storeRecord = await store.get(`${ConnextNodeStorePrefix}/${publicExtendedKey}`);

    if (!isLatestCfStoreVersion(storeRecord)) {
      logger.log(`Upgrading store to latest version ${LATEST_CF_STORE_VERSION}...`);
      await migrateToPatch1(store, `${ConnextNodeStorePrefix}/${publicExtendedKey}`);

      // delete old records
      await store.deleteLegacyCFCoreRecords();
      logger.log(`Upgraded to latest store version!`);
    } else {
      logger.log(`Detected latest store version ${LATEST_CF_STORE_VERSION}, will not migrate`);
    }
    // END MIGRATION

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
