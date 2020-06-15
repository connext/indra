import { CFCore } from "@connext/cf-core";
import { ERC20 } from "@connext/contracts";
import { MessagingService } from "@connext/messaging";
import { ConnextNodeStorePrefix } from "@connext/types";
import { Provider } from "@nestjs/common";
import { Contract, constants, utils } from "ethers";

import { ConfigService } from "../config/config.service";
import { CFCoreProviderId, MessagingProviderId } from "../constants";
import { LockService } from "../lock/lock.service";
import { LoggerService } from "../logger/logger.service";

import { CFCoreStore } from "./cfCore.store";

const { EtherSymbol } = constants;
const { formatEther } = utils;

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

    const ethBalance = await provider.getBalance(signerAddress);
    const tokenContract = new Contract(contractAddresses.Token, ERC20.abi, config.getSigner());
    const tknBalance = await tokenContract.balanceOf(signerAddress);

    log.info(
      `Balance of signer address ${signerAddress} on ${networkName} (chainId ${chainId}): ${EtherSymbol} ${formatEther(ethBalance)} & ${formatEther(tknBalance)} tokens`,
    );

    if (ethBalance.eq(constants.Zero)) {
      log.warn(`Warning: Node's ETH balance is zero`);
    }

    if (tknBalance.eq(constants.Zero)) {
      log.warn(`Warning: Node's Token balance is zero`);
    }

    log.info(`CFCore created with identifier: ${cfCore.publicIdentifier}`);
    return cfCore;
  },
};
