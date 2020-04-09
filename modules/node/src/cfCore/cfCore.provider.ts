import { ChannelSigner } from "@connext/crypto";
import { MessagingService } from "@connext/messaging";
import { ConnextNodeStorePrefix, IMessagingService, Opcode, ContractAddresses } from "@connext/types";
import { Provider } from "@nestjs/common";

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
    const provider = config.getEthProvider();
    const signer = config.getSigner();
    const signerAddress = await signer.getAddress();
    log.setContext("CFCoreProvider");
    log.info(`Derived address from mnemonic: ${signerAddress}`);

    // test that provider works
    const { chainId, name: networkName } = await config.getEthNetwork();
    const contractAddresses = await config.getContractAddresses();
    const cfCore = await CFCore.create(
      messaging as IMessagingService, // TODO: FIX
      store,
      contractAddresses,
      { STORE_KEY_PREFIX: ConnextNodeStorePrefix },
      provider,
      new ChannelSigner(
        await config.getPrivateKey(),
        await config.getEthProvider().connection.url,
      ),
      { acquireLock: lockService.lockedOperation.bind(lockService) },
      undefined,
      log.newContext("CFCore"),
    );
    // inject any default middlewares
    cfCore.injectMiddleware(
      Opcode.OP_VALIDATE,
      await generateMiddleware(
        signerAddress,
        {
          ...contractAddresses,
          provider,
        } as ContractAddresses,
        store,
      ),
    );
    const balance = (await provider.getBalance(signerAddress)).toString();
    log.info(
      `Balance of signer address ${signerAddress} on ${networkName} (chainId ${chainId}): ${balance}`,
    );
    log.info("CFCore created");
    return cfCore;
  },
};
