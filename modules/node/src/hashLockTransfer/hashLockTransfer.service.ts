import { HASHLOCK_TRANSFER_STATE_TIMEOUT } from "@connext/apps";
import {
  HashLockTransferAppName,
  HashLockTransferAppState,
  HashLockTransferStatus,
} from "@connext/types";
import { bigNumberifyJson, getSignerAddressFromPublicIdentifier, stringify } from "@connext/utils";
import { Injectable } from "@nestjs/common";
import { HashZero, Zero } from "ethers/constants";

import { CFCoreService } from "../cfCore/cfCore.service";
import { ChannelRepository } from "../channel/channel.repository";
import { ChannelService, RebalanceType } from "../channel/channel.service";
import { LoggerService } from "../logger/logger.service";
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

  async installHashLockTransferReceiverApp(
    senderIdentifier: string,
    receiverIdentifier: string,
    appState: HashLockTransferAppState,
    assetId: string,
    meta: any = {},
  ): Promise<{ appIdentityHash: string }> {
    this.log.info(
      `installHashLockTransferReceiverApp from ${senderIdentifier} to ${receiverIdentifier} assetId ${appState} appState ${JSON.stringify(
        appState,
      )} meta ${JSON.stringify(meta)} started`,
    );
    const receiverChannel = await this.channelRepository.findByUserPublicIdentifierOrThrow(
      receiverIdentifier,
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

    const existing = await this.findReceiverAppByLockHash(appState.lockHash);
    if (existing) {
      const result = { appIdentityHash: existing.identityHash };
      this.log.warn(`Found existing hashlock transfer app, returning: ${stringify(result)}`);
      return result;
    }

    const freeBalanceAddr = this.cfCoreService.cfCore.signerAddress;

    const receiverFreeBal = await this.cfCoreService.getFreeBalance(
      receiverIdentifier,
      receiverChannel.multisigAddress,
      assetId,
    );
    if (receiverFreeBal[freeBalanceAddr].lt(amount)) {
      // request collateral and wait for deposit to come through
      const depositReceipt = await this.channelService.rebalance(
        receiverIdentifier,
        assetId,
        RebalanceType.COLLATERALIZE,
        amount,
      );
      if (!depositReceipt) {
        throw new Error(
          `Could not deposit sufficient collateral to resolve hash lock transfer app for reciever: ${receiverIdentifier}`,
        );
      }
    } else {
      // request collateral normally without awaiting
      this.channelService.rebalance(
        receiverIdentifier,
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
          to: getSignerAddressFromPublicIdentifier(receiverIdentifier),
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
      { ...meta, sender: senderIdentifier },
      HASHLOCK_TRANSFER_STATE_TIMEOUT,
    );

    if (!receiverAppInstallRes || !receiverAppInstallRes.appIdentityHash) {
      throw new Error(`Could not install app on receiver side.`);
    }

    const response = {
      appIdentityHash: receiverAppInstallRes.appIdentityHash,
    };
    this.log.info(
      `installHashLockTransferReceiverApp from ${senderIdentifier} to ${receiverIdentifier} assetId ${appState} completed: ${JSON.stringify(
        response,
      )}`,
    );
    return response;
  }

  async findSenderAndReceiverAppsWithStatus(
    lockHash: string,
  ): Promise<{ senderApp: AppInstance; receiverApp: AppInstance; status: any } | undefined> {
    this.log.info(`findSenderAndReceiverAppsWithStatus ${lockHash} started`);
    const senderApp = await this.findSenderAppByLockHash(lockHash);
    const receiverApp = await this.findReceiverAppByLockHash(lockHash);
    const block = await this.configService.getEthProvider().getBlockNumber();
    const status = appStatusesToHashLockTransferStatus(block, senderApp, receiverApp);
    const result = { senderApp, receiverApp, status };
    this.log.info(
      `findSenderAndReceiverAppsWithStatus ${lockHash} completed: ${JSON.stringify(result)}`,
    );
    return result;
  }

  async findSenderAppByLockHash(lockHash: string): Promise<AppInstance> {
    this.log.info(`findSenderAppByLockHash ${lockHash} started`);
    // node receives from sender
    const app = await this.appInstanceRepository.findHashLockTransferAppsByLockHashAndReceiver(
      lockHash,
      this.cfCoreService.cfCore.signerAddress,
    );
    const result = normalizeHashLockTransferAppState(app);
    this.log.info(`findSenderAppByLockHash ${lockHash} completed: ${JSON.stringify(result)}`);
    return result;
  }

  async findReceiverAppByLockHash(lockHash: string): Promise<AppInstance> {
    this.log.info(`findReceiverAppByLockHash ${lockHash} started`);
    // node sends to receiver
    const app = await this.appInstanceRepository.findHashLockTransferAppsByLockHashAndSender(
      lockHash,
      this.cfCoreService.cfCore.signerAddress,
    );
    const result = normalizeHashLockTransferAppState(app);
    this.log.info(`findReceiverAppByLockHash ${lockHash} completed: ${JSON.stringify(result)}`);
    return result;
  }
}
