import {
  HashLockTransferAppName,
  HashLockTransferAppState,
  HashLockTransferStatus,
  Address,
  Bytes32,
} from "@connext/types";
import { bigNumberifyJson } from "@connext/utils";
import { Injectable } from "@nestjs/common";
import { constants } from "ethers";

import { CFCoreService } from "../cfCore/cfCore.service";
import { LoggerService } from "../logger/logger.service";
import { ConfigService } from "../config/config.service";
import { AppType, AppInstance } from "../appInstance/appInstance.entity";

import { HashlockTransferRepository } from "./hashlockTransfer.repository";

const { HashZero } = constants;

const appStatusesToHashLockTransferStatus = (
  currentBlockNumber: number,
  senderApp: AppInstance<typeof HashLockTransferAppName>,
  receiverApp?: AppInstance<typeof HashLockTransferAppName>,
): HashLockTransferStatus | undefined => {
  if (!receiverApp) {
    return undefined;
  }
  const latestState = bigNumberifyJson(receiverApp.latestState) as HashLockTransferAppState;
  const { expiry: senderExpiry } = latestState;
  const isSenderExpired = senderExpiry.lt(currentBlockNumber);
  const isReceiverExpired = !senderApp ? false : latestState.expiry.lt(currentBlockNumber);
  // pending iff no receiver app + not expired
  if (!senderApp) {
    return isSenderExpired ? HashLockTransferStatus.EXPIRED : HashLockTransferStatus.PENDING;
  } else if (senderApp.latestState.preImage !== HashZero || latestState.preImage !== HashZero) {
    return HashLockTransferStatus.COMPLETED;
  } else if (
    senderApp.type === AppType.REJECTED ||
    receiverApp.type === AppType.REJECTED ||
    senderApp.type === AppType.UNINSTALLED ||
    receiverApp.type === AppType.UNINSTALLED
  ) {
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
    throw new Error(
      `Could not determine hash lock transfer status. Sender app type: ${
        senderApp && senderApp.type
      }, receiver app type: ${receiverApp && receiverApp.type}`,
    );
  }
};

@Injectable()
export class HashLockTransferService {
  constructor(
    private readonly cfCoreService: CFCoreService,
    private readonly configService: ConfigService,
    private readonly log: LoggerService,
    private readonly hashlockTransferRepository: HashlockTransferRepository,
  ) {
    this.log.setContext("HashLockTransferService");
  }

  async findSenderAndReceiverAppsWithStatus(
    lockHash: Bytes32,
    assetId: Address,
  ): Promise<{ senderApp: AppInstance; receiverApp: AppInstance; status: any } | undefined> {
    this.log.info(`findSenderAndReceiverAppsWithStatus ${lockHash} started`);
    const senderApp = await this.findSenderAppByLockHashAndAssetId(lockHash, assetId);
    const receiverApp = await this.findReceiverAppByLockHashAndAssetId(lockHash, assetId);
    const block = await this.configService.getEthProvider().getBlockNumber();
    const status = appStatusesToHashLockTransferStatus(block, senderApp, receiverApp);
    const result = { senderApp, receiverApp, status };
    this.log.info(
      `findSenderAndReceiverAppsWithStatus ${lockHash} completed: ${JSON.stringify(result)}`,
    );
    return result;
  }

  async findSenderAppByLockHashAndAssetId(
    lockHash: Bytes32,
    assetId: Address,
  ): Promise<AppInstance<"HashLockTransferApp">> {
    this.log.info(`findSenderAppByLockHash ${lockHash} started`);
    // node receives from sender
    // eslint-disable-next-line max-len
    const app = await this.hashlockTransferRepository.findHashLockTransferAppsByLockHashAssetIdAndReceiver(
      lockHash,
      this.cfCoreService.cfCore.signerAddress,
      assetId,
      this.cfCoreService.getAppInfoByName(HashLockTransferAppName).appDefinitionAddress,
    );
    this.log.info(`findSenderAppByLockHash ${lockHash} completed: ${JSON.stringify(app)}`);
    return app;
  }

  async findReceiverAppByLockHashAndAssetId(
    lockHash: Bytes32,
    assetId: Address,
  ): Promise<AppInstance<"HashLockTransferApp">> {
    this.log.info(`findReceiverAppByLockHash ${lockHash} started`);
    // node sends to receiver
    // eslint-disable-next-line max-len
    const app = await this.hashlockTransferRepository.findHashLockTransferAppByLockHashAssetIdAndSender(
      lockHash,
      this.cfCoreService.cfCore.signerAddress,
      assetId,
      this.cfCoreService.getAppInfoByName(HashLockTransferAppName).appDefinitionAddress,
    );
    this.log.info(`findReceiverAppByLockHash ${lockHash} completed: ${JSON.stringify(app)}`);
    return app;
  }
}
