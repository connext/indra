import { MessagingService } from "@connext/messaging";
import { HashLockTransferAppState, NodeResponses } from "@connext/types";
import { bigNumberifyJson } from "@connext/utils";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { RpcException } from "@nestjs/microservices";

import { AuthService } from "../auth/auth.service";
import { LoggerService } from "../logger/logger.service";
import { MessagingProviderId, LinkedTransferProviderId } from "../constants";
import { CFCoreService } from "../cfCore/cfCore.service";
import { ConfigService } from "../config/config.service";
import { ChannelRepository } from "../channel/channel.repository";
import { AbstractMessagingProvider } from "../messaging/abstract.provider";

import { HashLockTransferService } from "./hashLockTransfer.service";

export class HashLockTransferMessaging extends AbstractMessagingProvider {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    log: LoggerService,
    messaging: MessagingService,
    private readonly hashLockTransferService: HashLockTransferService,
  ) {
    super(log, messaging);
    log.setContext("LinkedTransferMessaging");
  }

  async getHashLockTransferByLockHash(
    pubId: string,
    data: { lockHash: string },
  ): Promise<NodeResponses.GetHashLockTransfer> {
    const { lockHash } = data;
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
    } = await this.hashLockTransferService.findSenderAndReceiverAppsWithStatus(lockHash);
    if (!senderApp) {
      return undefined;
    }

    const latestState = bigNumberifyJson(senderApp.latestState) as HashLockTransferAppState;
    const { encryptedPreImage, recipient, ...meta } = senderApp.meta || ({} as any);
    const amount = latestState.coinTransfers[0].amount.isZero()
      ? latestState.coinTransfers[1].amount
      : latestState.coinTransfers[0].amount;
    return {
      receiverIdentifier: receiverApp ? receiverApp.responderIdentifier : undefined,
      senderIdentifier: senderApp.initiatorIdentifier,
      assetId: senderApp.initiatorDepositAssetId,
      amount: amount.toString(),
      lockHash: latestState.lockHash,
      status: status,
      meta,
    };
  }

  async setupSubscriptions(): Promise<void> {
    await super.connectRequestReponse(
      `*.${this.configService.getPublicIdentifier()}.transfer.get-hashlock`,
      this.authService.parseIdentifier(this.getHashLockTransferByLockHash.bind(this)),
    );
  }
}

export const hashLockTransferProviderFactory: FactoryProvider<Promise<void>> = {
  inject: [
    AuthService,
    ConfigService,
    LoggerService,
    MessagingProviderId,
    HashLockTransferService,
    CFCoreService,
    ChannelRepository,
  ],
  provide: LinkedTransferProviderId,
  useFactory: async (
    authService: AuthService,
    configService: ConfigService,
    logging: LoggerService,
    messaging: MessagingService,
    hashLockTransferService: HashLockTransferService,
  ): Promise<void> => {
    const transfer = new HashLockTransferMessaging(
      authService,
      configService,
      logging,
      messaging,
      hashLockTransferService,
    );
    await transfer.setupSubscriptions();
  },
};
