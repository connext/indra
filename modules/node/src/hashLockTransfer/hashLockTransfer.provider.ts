import { MessagingService } from "@connext/messaging";
import { HashLockTransferAppState, NodeResponses } from "@connext/types";
import { bigNumberifyJson } from "@connext/utils";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { RpcException } from "@nestjs/microservices";
import { constants } from "ethers";

import { AuthService } from "../auth/auth.service";
import { LoggerService } from "../logger/logger.service";
import { MessagingProviderId, LinkedTransferProviderId } from "../constants";
import { CFCoreService } from "../cfCore/cfCore.service";
import { ChannelRepository } from "../channel/channel.repository";
import { AbstractMessagingProvider } from "../messaging/abstract.provider";

import { HashLockTransferService } from "./hashLockTransfer.service";
import { AppInstance } from "src/appInstance/appInstance.entity";

const { AddressZero } = constants;

export class HashLockTransferMessaging extends AbstractMessagingProvider {
  constructor(
    private readonly authService: AuthService,
    log: LoggerService,
    messaging: MessagingService,
    private readonly hashLockTransferService: HashLockTransferService,
  ) {
    super(log, messaging);
    log.setContext("LinkedTransferMessaging");
  }

  async getHashLockTransferByLockHash(
    pubId: string,
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
      preImage: receiverApp?.latestState?.preImage || userApp.latestState.preImage,
      expiry: latestState.expiry,
    };
  }

  async setupSubscriptions(): Promise<void> {
    await super.connectRequestReponse(
      "*.transfer.get-hashlock",
      this.authService.parseIdentifier(this.getHashLockTransferByLockHash.bind(this)),
    );
  }
}

export const hashLockTransferProviderFactory: FactoryProvider<Promise<void>> = {
  inject: [
    AuthService,
    LoggerService,
    MessagingProviderId,
    HashLockTransferService,
    CFCoreService,
    ChannelRepository,
  ],
  provide: LinkedTransferProviderId,
  useFactory: async (
    authService: AuthService,
    logging: LoggerService,
    messaging: MessagingService,
    hashLockTransferService: HashLockTransferService,
  ): Promise<void> => {
    const transfer = new HashLockTransferMessaging(
      authService,
      logging,
      messaging,
      hashLockTransferService,
    );
    await transfer.setupSubscriptions();
  },
};
