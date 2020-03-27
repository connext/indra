import { MessagingService } from "@connext/messaging";
import {
  bigNumberifyJson,
  GetHashLockTransferResponse,
  HashLockTransferAppState,
  ResolveHashLockTransferResponse,
} from "@connext/types";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { RpcException } from "@nestjs/microservices";

import { AuthService } from "../auth/auth.service";
import { LoggerService } from "../logger/logger.service";
import { MessagingProviderId, LinkedTransferProviderId } from "../constants";
import { AbstractMessagingProvider } from "../util";
import { CFCoreService } from "../cfCore/cfCore.service";
import { ChannelRepository } from "../channel/channel.repository";

import { HashLockTransferService } from "./hashLockTransfer.service";

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

  async resolveHashLockTransfer(
    pubId: string,
    { lockHash }: { lockHash: string },
  ): Promise<ResolveHashLockTransferResponse> {
    this.log.error(`Got resolve link request with lockHash: ${lockHash}`);
    if (!lockHash) {
      throw new RpcException(`Incorrect data received. Data: ${JSON.stringify(lockHash)}`);
    }
    const response = await this.hashLockTransferService.resolveHashLockTransfer(pubId, lockHash);
    return {
      ...response,
      amount: response.amount,
    };
  }

  async getHashLockTransferByLockHash(
    pubId: string,
    data: { lockHash: string },
  ): Promise<GetHashLockTransferResponse> {
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
      receiverPublicIdentifier: receiverApp ? receiverApp.channel.userPublicIdentifier : undefined,
      senderPublicIdentifier: senderApp.channel.userPublicIdentifier,
      assetId: senderApp.initiatorDepositTokenAddress,
      amount: amount.toString(),
      lockHash: latestState.lockHash,
      status: status,
      meta,
    };
  }

  async setupSubscriptions(): Promise<void> {
    await super.connectRequestReponse(
      "*.transfer.resolve-hashlock",
      this.authService.parseXpub(this.resolveHashLockTransfer.bind(this)),
    );

    await super.connectRequestReponse(
      "*.transfer.get-hashlock",
      this.authService.parseXpub(this.getHashLockTransferByLockHash.bind(this)),
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
