import { MessagingService } from "@connext/messaging";
import { CF_PATH, ConnextNodeStorePrefix, IMessagingService, Opcode, ContractAddresses } from "@connext/types";
import { Provider } from "@nestjs/common";
import { fromMnemonic } from "ethers/utils/hdnode";

import { ConfigService } from "../config/config.service";
import { CFCoreProviderId, MessagingProviderId } from "../constants";
import { LockService } from "../lock/lock.service";
import { LoggerService } from "../logger/logger.service";
import { CFCore } from "../util/cfCore";

import { CFCoreStore } from "./cfCore.store";
import { generateMiddleware } from "./middleware";

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
    const hdNode = fromMnemonic(config.getMnemonic()).derivePath(CF_PATH);
    const publicExtendedKey = config.getPublicIdentifier();
    const provider = config.getEthProvider();
    log.setContext("CFCoreProvider");
    log.info(`Derived xpub from mnemonic: ${publicExtendedKey}`);

    // test that provider works
    const { chainId, name: networkName } = await config.getEthNetwork();
    const contractAddresses = await config.getContractAddresses();
    const cfCore = await CFCore.create(
      messaging as IMessagingService, // TODO: FIX
      store,
      contractAddresses,
      { STORE_KEY_PREFIX: ConnextNodeStorePrefix },
      provider,
      { acquireLock: lockService.lockedOperation.bind(lockService) },
      publicExtendedKey,
      // key gen fn
      (uniqueId: string): Promise<string> => {
        return Promise.resolve(hdNode.derivePath(uniqueId).privateKey);
      },
      undefined,
      log.newContext("CFCore"),
    );
    // inject any default middlewares
    cfCore.injectMiddleware(
      Opcode.OP_VALIDATE,
      await generateMiddleware(
        publicExtendedKey,
        {
          ...contractAddresses,
          provider,
        } as ContractAddresses,
        store,
      ),
    );
    const signerAddr = await cfCore.signerAddress();
    const balance = (await provider.getBalance(signerAddr)).toString();
    log.info(
      `Balance of signer address ${signerAddr} on ${networkName} (chainId ${chainId}): ${balance}`,
    );
    log.info("CFCore created");
    return cfCore;
  },
};
