import { Node as CFCore } from "@connext/cf-core";
import { MessagingService } from "@connext/messaging";
import { ConnextNodeStorePrefix } from "@connext/types";
import { Provider } from "@nestjs/common";

import { ConfigService } from "../config/config.service";
import { CFCoreProviderId, MessagingProviderId } from "../constants";
import { LockService } from "../lock/lock.service";
import { LoggerService } from "../logger/logger.service";

import { CFCoreStore } from "./cfCore.store";

export const cfCoreProviderFactory: Provider = {
  inject: [ConfigService, LockService, LoggerService, MessagingProviderId, CFCoreStore],
  provide: CFCoreProviderId,
  useFactory: async (
    config: ConfigService,
    lockService: LockService,
    log: LoggerService,
    messaging: MessagingService,
    store: CFCoreStore,
  ): Promise<CFCore> => {
    const provider = config.getEthProvider();
    const signer = config.getSigner();
    const signerAddress = await signer.getAddress();
    log.setContext("CFCoreProvider");
    log.info(`Derived address from mnemonic: ${signerAddress}`);

    // test that provider works
    const { chainId, name: networkName } = await config.getEthNetwork();
    const contractAddresses = await config.getContractAddresses();
    const cfCore = await CFCore.create(
      messaging,
      store,
      contractAddresses,
      { STORE_KEY_PREFIX: ConnextNodeStorePrefix },
      provider,
      config.getSigner(),
      { 
        acquireLock: lockService.acquireLock.bind(lockService),
        releaseLock: lockService.releaseLock.bind(lockService),
      },
      undefined,
      log.newContext("CFCore"),
      false, // only clients sync on cf core start
    );
    const balance = (await provider.getBalance(signerAddress)).toString();
    log.info(
      `Balance of signer address ${signerAddress} on ${networkName} (chainId ${chainId}): ${balance}`,
    );
    log.info("CFCore created");
    return cfCore;
  },
};
