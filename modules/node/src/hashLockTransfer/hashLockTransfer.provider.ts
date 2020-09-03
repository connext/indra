import { MessagingService } from "@connext/messaging";
import { HashLockTransferAppState, NodeResponses } from "@connext/types";
import { bigNumberifyJson } from "@connext/utils";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { RpcException } from "@nestjs/microservices";
import { constants } from "ethers";

import { AuthService } from "../auth/auth.service";
import { LoggerService } from "../logger/logger.service";
import { MessagingProviderId, LinkedTransferProviderId } from "../constants";
import { AbstractMessagingProvider } from "../messaging/abstract.provider";

import { HashLockTransferService } from "./hashLockTransfer.service";
import { AppInstance } from "../appInstance/appInstance.entity";
import { ConfigService } from "../config/config.service";

const { AddressZero, HashZero } = constants;

export class HashLockTransferMessaging extends AbstractMessagingProvider {
  constructor(
    private readonly authService: AuthService,
    log: LoggerService,
    messaging: MessagingService,
    private readonly configService: ConfigService,
    private readonly hashLockTransferService: HashLockTransferService,
  ) {
    super(log, messaging);
    log.setContext("LinkedTransferMessaging");
  }

  async getHashLockTransferByLockHash(
    pubId: string,
    chainId: number,
    data: { lockHash: string; assetId: string },
  ): Promise<NodeResponses.GetHashLockTransfer> {
    const { lockHash, assetId } = data;
    if (!lockHash) {
      throw new RpcException(`Incorrect data received. Data: ${JSON.stringify(data)}`);
    }
    this.log.info(`Got fetch hashlock request for: ${lockHash}`);

    // determine status
    // node receives transfer in sender app
    const {
      senderApp,
      status,
      receiverApp,
    } = await this.hashLockTransferService.findSenderAndReceiverAppsWithStatus(
      lockHash,
      assetId || AddressZero,
      chainId,
    );
    if (!senderApp && !receiverApp) {
      return undefined;
    }

    let userApp: AppInstance<"HashLockTransferApp">;
    if (pubId === receiverApp?.responderIdentifier) {
      userApp = receiverApp;
    } else if (pubId === senderApp?.initiatorIdentifier) {
      userApp = senderApp;
    } else {
      this.log.error(
        `Cannot get hashlock transfer app for third party. Requestor pubId: ${pubId}, 
        sender pubId: ${senderApp?.initiatorIdentifier}, receiver pubId: ${receiverApp?.responderIdentifier}`,
      );
      return undefined;
    }

    const latestState = bigNumberifyJson(userApp.latestState) as HashLockTransferAppState;
    const { encryptedPreImage, recipient, ...meta } = userApp.meta || ({} as any);
    const amount = latestState.coinTransfers[0].amount.isZero()
      ? latestState.coinTransfers[1].amount
      : latestState.coinTransfers[0].amount;
    return {
      receiverIdentifier: recipient,
      senderIdentifier: meta.sender,
      assetId: userApp.initiatorDepositAssetId,
      amount: amount.toString(),
      lockHash: latestState.lockHash,
      status,
      meta,
      preImage:
        receiverApp?.latestState?.preImage === HashZero
          ? userApp.latestState.preImage
          : receiverApp?.latestState?.preImage,
      expiry: latestState.expiry,
      senderAppIdentityHash: senderApp?.identityHash,
      receiverAppIdentityHash: receiverApp?.identityHash,
    };
  }

  async setupSubscriptions(): Promise<void> {
    await super.connectRequestReponse(
      `*.${this.configService.getPublicIdentifier()}.*.transfer.get-hashlock`,
      this.authService.parseIdentifierAndChain(this.getHashLockTransferByLockHash.bind(this)),
    );
  }
}

export const hashLockTransferProviderFactory: FactoryProvider<Promise<void>> = {
  inject: [AuthService, LoggerService, MessagingProviderId, ConfigService, HashLockTransferService],
  provide: LinkedTransferProviderId,
  useFactory: async (
    authService: AuthService,
    logging: LoggerService,
    messaging: MessagingService,
    configService: ConfigService,
    hashLockTransferService: HashLockTransferService,
  ): Promise<void> => {
    const transfer = new HashLockTransferMessaging(
      authService,
      logging,
      messaging,
      configService,
      hashLockTransferService,
    );
    await transfer.setupSubscriptions();
  },
};
