import { HashLockTransferAppName, HashLockTransferStatus, Address, Bytes32 } from "@connext/types";
import { Injectable } from "@nestjs/common";

import { CFCoreService } from "../cfCore/cfCore.service";
import { LoggerService } from "../logger/logger.service";
import { ConfigService } from "../config/config.service";
import { AppInstance } from "../appInstance/appInstance.entity";

import { HashlockTransferRepository } from "./hashlockTransfer.repository";
import { appStatusesToTransferWithExpiryStatus } from "../utils";

const appStatusesToHashLockTransferStatus = (
  currentBlockNumber: number,
  senderApp: AppInstance<typeof HashLockTransferAppName>,
  receiverApp?: AppInstance<typeof HashLockTransferAppName>,
): HashLockTransferStatus | undefined => {
  return appStatusesToTransferWithExpiryStatus<typeof HashLockTransferAppName>(
    currentBlockNumber,
    senderApp,
    receiverApp,
  );
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
    chainId: number,
  ): Promise<{
    senderApp: AppInstance | undefined;
    receiverApp: AppInstance | undefined;
    status: any;
  }> {
    this.log.info(`findSenderAndReceiverAppsWithStatus ${lockHash} started`);
    const senderApp = await this.findSenderAppByLockHashAndAssetId(lockHash, assetId, chainId);
    const receiverApp = await this.findReceiverAppByLockHashAndAssetId(lockHash, assetId, chainId);
    const block = await this.configService.getEthProvider(chainId)!.getBlockNumber();
    const status = senderApp
      ? appStatusesToHashLockTransferStatus(block, senderApp, receiverApp)
      : "unknown";
    const result = { senderApp, receiverApp, status };
    this.log.info(
      `findSenderAndReceiverAppsWithStatus ${lockHash} completed: ${JSON.stringify(result)}`,
    );
    return result;
  }

  async findSenderAppByLockHashAndAssetId(
    lockHash: Bytes32,
    assetId: Address,
    chainId: number,
  ): Promise<AppInstance<"HashLockTransferApp"> | undefined> {
    this.log.info(`findSenderAppByLockHash ${lockHash} started`);
    // node receives from sender
    // eslint-disable-next-line max-len
    const app = await this.hashlockTransferRepository.findHashLockTransferAppsByLockHashAssetIdAndReceiver(
      lockHash,
      this.cfCoreService.cfCore.signerAddress,
      assetId,
      this.cfCoreService.getAppInfoByNameAndChain(HashLockTransferAppName, chainId)
        .appDefinitionAddress,
    );
    this.log.info(`findSenderAppByLockHash ${lockHash} completed: ${JSON.stringify(app)}`);
    return app;
  }

  async findReceiverAppByLockHashAndAssetId(
    lockHash: Bytes32,
    assetId: Address,
    chainId: number,
  ): Promise<AppInstance<"HashLockTransferApp"> | undefined> {
    this.log.info(`findReceiverAppByLockHash ${lockHash} started`);
    // node sends to receiver
    // eslint-disable-next-line max-len
    const app = await this.hashlockTransferRepository.findHashLockTransferAppByLockHashAssetIdAndSender(
      lockHash,
      this.cfCoreService.cfCore.signerAddress,
      assetId,
      this.cfCoreService.getAppInfoByNameAndChain(HashLockTransferAppName, chainId)
        .appDefinitionAddress,
    );
    this.log.info(`findReceiverAppByLockHash ${lockHash} completed: ${JSON.stringify(app)}`);
    return app;
  }
}
