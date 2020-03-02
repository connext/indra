import { MessagingService, MessagingServiceFactory } from "@connext/messaging";
import { CF_PATH, ConnextNodeStorePrefix, ILoggerService } from "@connext/types";
import { Provider } from "@nestjs/common";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { fromMnemonic } from "ethers/utils/hdnode";

import { ConfigService } from "../config/config.service";
import { CFCoreProviderId, MessagingProviderId } from "../constants";
import { LockService } from "../lock/lock.service";
import { LoggerService } from "../logger/logger.service";
import { AuthService } from "../auth/auth.service";
import { CFCore } from "../util/cfCore";

import { CFCoreRecordRepository } from "./cfCore.repository";

export const cfCoreProviderFactory: Provider = {
  inject: [ConfigService, LockService, LoggerService, MessagingProviderId, CFCoreRecordRepository],
  provide: CFCoreProviderId,
  useFactory: async (
    config: ConfigService,
    lockService: LockService,
    log: LoggerService,
    messaging: MessagingService,
    store: CFCoreRecordRepository,
  ): Promise<CFCore> => {
    const hdNode = fromMnemonic(config.getMnemonic()).derivePath(CF_PATH);
    const publicExtendedKey = config.publicIdentifier;
    const provider = config.getEthProvider();
    log.setContext("CFCoreProvider");
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
      undefined,
      log.newContext("CFCore"),
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

// TODO: bypass factory
export const messagingProviderFactory: FactoryProvider<Promise<MessagingService>> = {
  inject: [ConfigService, AuthService, LoggerService],
  provide: MessagingProviderId,
  useFactory: async (config: ConfigService, auth: AuthService, log: LoggerService): Promise<MessagingService> => {
    const getBearerToken = async (): Promise<string> => {
      const nonce = await auth.getNonce(config.publicIdentifier);
      const signedNonce = await config.getEthWallet().signMessage(nonce)
      return auth.verifyAndVend(signedNonce, config.publicIdentifier);
    }
    const messagingService = new MessagingService(config.getMessagingConfig(), "indra", getBearerToken);
    await messagingService.connect();
    return messagingService;
  },
};