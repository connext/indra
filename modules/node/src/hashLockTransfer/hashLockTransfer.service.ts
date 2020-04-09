import { HASHLOCK_TRANSFER_STATE_TIMEOUT } from "@connext/apps";
import {
  bigNumberifyJson,
  HashLockTransferAppName,
  HashLockTransferAppState,
  HashLockTransferStatus,
} from "@connext/types";
import { Injectable } from "@nestjs/common";
import { HashZero, Zero } from "ethers/constants";

import { CFCoreService } from "../cfCore/cfCore.service";
import { ChannelRepository } from "../channel/channel.repository";
import { ChannelService, RebalanceType } from "../channel/channel.service";
import { LoggerService } from "../logger/logger.service";
import { xkeyKthAddress } from "../util";
import { TIMEOUT_BUFFER } from "../constants";
import { ConfigService } from "../config/config.service";
import { AppType, AppInstance } from "../appInstance/appInstance.entity";
import { AppInstanceRepository } from "../appInstance/appInstance.repository";

const appStatusesToHashLockTransferStatus = (
  currentBlockNumber: number,
  senderApp: AppInstance<HashLockTransferAppState>,
  receiverApp?: AppInstance<HashLockTransferAppState>,
): HashLockTransferStatus | undefined => {
  if (!senderApp) {
    return undefined;
  }
  const latestState = bigNumberifyJson(senderApp.latestState) as HashLockTransferAppState;
  const { timelock: senderTimelock } = latestState;
  const isSenderExpired = senderTimelock.lt(currentBlockNumber);
  const isReceiverExpired = !receiverApp ? false : latestState.timelock.lt(currentBlockNumber);
  // pending iff no receiver app + not expired
  if (!receiverApp) {
    return isSenderExpired ? HashLockTransferStatus.EXPIRED : HashLockTransferStatus.PENDING;
  } else if (
    senderApp.latestState.preImage !== HashZero ||
    receiverApp.latestState.preImage !== HashZero
  ) {
    // iff sender uninstalled, payment is unlocked
    return HashLockTransferStatus.COMPLETED;
  } else if (senderApp.type === AppType.REJECTED || receiverApp.type === AppType.REJECTED) {
    return HashLockTransferStatus.FAILED;
  } else if (isReceiverExpired && receiverApp.type === AppType.INSTANCE) {
    // iff there is a receiver app, check for expiry
    // do this last bc could be retrieving historically
    return HashLockTransferStatus.EXPIRED;
  } else if (!isReceiverExpired && receiverApp.type === AppType.INSTANCE) {
    // iff there is a receiver app, check for expiry
    // do this last bc could be retrieving historically
    return HashLockTransferStatus.PENDING;
  } else {
    throw new Error(`Cound not determine hash lock transfer status`);
  }
};

export const normalizeHashLockTransferAppState = (
  app: AppInstance,
): AppInstance<HashLockTransferAppState> | undefined => {
  return (
    app && {
      ...app,
      latestState: app.latestState as HashLockTransferAppState,
    }
  );
};

@Injectable()
export class HashLockTransferService {
  constructor(
    private readonly cfCoreService: CFCoreService,
    private readonly channelService: ChannelService,
    private readonly configService: ConfigService,
    private readonly log: LoggerService,
    private readonly channelRepository: ChannelRepository,
    private readonly appInstanceRepository: AppInstanceRepository,
  ) {
    this.log.setContext("HashLockTransferService");
  }

  async resolveHashLockTransfer(
    senderPublicIdentifier: string,
    receiverPublicIdentifier: string,
    appState: HashLockTransferAppState,
    assetId: string,
    meta: any = {},
  ): Promise<any> {
    this.log.debug(`resolveHashLockTransfer()`);
    const receiverChannel = await this.channelRepository.findByUserPublicIdentifierOrThrow(
      receiverPublicIdentifier,
    );

    // sender amount
    const amount = appState.coinTransfers[0].amount;
    const timelock = appState.timelock.sub(TIMEOUT_BUFFER);
    if (timelock.lte(Zero)) {
      throw new Error(
        `Cannot resolve hash lock transfer with 0 or negative timelock: ${timelock.toString()}`,
      );
    }
    const provider = this.configService.getEthProvider();
    const currBlock = await provider.getBlockNumber();
    if (timelock.lt(currBlock)) {
      throw new Error(
        `Cannot resolve hash lock transfer with expired timelock: ${timelock.toString()}, block: ${currBlock}`,
      );
    }

    const freeBalanceAddr = this.cfCoreService.cfCore.signerAddress;

    const receiverFreeBal = await this.cfCoreService.getFreeBalance(
      receiverPublicIdentifier,
      receiverChannel.multisigAddress,
      assetId,
    );
    if (receiverFreeBal[freeBalanceAddr].lt(amount)) {
      // request collateral and wait for deposit to come through
      const depositReceipt = await this.channelService.rebalance(
        receiverPublicIdentifier,
        assetId,
        RebalanceType.COLLATERALIZE,
        amount,
      );
      if (!depositReceipt) {
        throw new Error(`Could not deposit sufficient collateral to resolve hash lock transfer app for reciever: ${receiverPublicIdentifier}`);
      }
    } else {
      // request collateral normally without awaiting
      this.channelService.rebalance(
        receiverPublicIdentifier,
        assetId,
        RebalanceType.COLLATERALIZE,
        amount,
      );
    }

    const initialState: HashLockTransferAppState = {
      coinTransfers: [
        {
          amount,
          to: freeBalanceAddr,
        },
        {
          amount: Zero,
          to: xkeyKthAddress(receiverPublicIdentifier),
        },
      ],
      lockHash: appState.lockHash,
      preImage: HashZero,
      timelock,
      finalized: false,
    };

    const receiverAppInstallRes = await this.cfCoreService.proposeAndWaitForInstallApp(
      receiverChannel,
      initialState,
      amount,
      assetId,
      Zero,
      assetId,
      HashLockTransferAppName,
      { ...meta, sender: senderPublicIdentifier },
      HASHLOCK_TRANSFER_STATE_TIMEOUT,
    );

    if (!receiverAppInstallRes || !receiverAppInstallRes.appIdentityHash) {
      throw new Error(`Could not install app on receiver side.`);
    }

    return {
      appIdentityHash: receiverAppInstallRes.appIdentityHash,
    };
  }

  async findSenderAndReceiverAppsWithStatus(
    lockHash: string,
  ): Promise<{ senderApp: AppInstance; receiverApp: AppInstance; status: any } | undefined> {
    // node receives from sender
    const senderApp = await this.findSenderAppByLockHash(lockHash);
    // node is sender
    const receiverApp = await this.findReceiverAppByLockHash(lockHash);
    const block = await this.configService.getEthProvider().getBlockNumber();
    const status = appStatusesToHashLockTransferStatus(block, senderApp, receiverApp);
    return { senderApp, receiverApp, status };
  }

  async findSenderAppByLockHash(lockHash: string): Promise<AppInstance> {
    // node receives from sender
    const app = await this.appInstanceRepository.findHashLockTransferAppsByLockHashAndReceiver(
      lockHash,
      this.cfCoreService.cfCore.signerAddress,
    );
    return normalizeHashLockTransferAppState(app);
  }

  async findReceiverAppByLockHash(lockHash: string): Promise<AppInstance> {
    // node sends to receiver
    const app = await this.appInstanceRepository.findHashLockTransferAppsByLockHashAndSender(
      lockHash,
      this.cfCoreService.cfCore.signerAddress,
    );
    return normalizeHashLockTransferAppState(app);
  }
}
