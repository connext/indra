import { MessagingService } from "@connext/messaging";
import { LinkedTransferStatus, NodeResponses, SimpleLinkedTransferAppState } from "@connext/types";
import { bigNumberifyJson } from "@connext/utils";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { RpcException } from "@nestjs/microservices";

import { AuthService } from "../auth/auth.service";
import { LoggerService } from "../logger/logger.service";
import { MessagingProviderId, LinkedTransferProviderId } from "../constants";
import { AbstractMessagingProvider } from "../messaging/abstract.provider";

import { LinkedTransferService } from "./linkedTransfer.service";

export class LinkedTransferMessaging extends AbstractMessagingProvider {
  constructor(
    private readonly authService: AuthService,
    log: LoggerService,
    messaging: MessagingService,
    private readonly linkedTransferService: LinkedTransferService,
  ) {
    super(log, messaging);
    log.setContext("LinkedTransferMessaging");
  }

  async getLinkedTransferByPaymentId(
    pubId: string,
    data: { paymentId: string },
  ): Promise<NodeResponses.GetLinkedTransfer | undefined> {
    const { paymentId } = data;
    if (!paymentId) {
      throw new RpcException(`Incorrect data received. Data: ${JSON.stringify(data)}`);
    }
    this.log.info(`Got fetch link request for: ${paymentId}`);

    // determine status
    // node receives transfer in sender app
    const {
      senderApp,
      status,
    } = await this.linkedTransferService.findSenderAndReceiverAppsWithStatus(paymentId);
    if (!senderApp) {
      return undefined;
    }

    const latestState = bigNumberifyJson(senderApp.latestState) as SimpleLinkedTransferAppState;
    const { encryptedPreImage, recipient, ...meta } = senderApp.meta || ({} as any);
    return {
      amount: latestState.coinTransfers[0].amount.isZero()
        ? latestState.coinTransfers[1].amount
        : latestState.coinTransfers[0].amount,
      assetId: senderApp.initiatorDepositAssetId,
      createdAt: senderApp.createdAt,
      encryptedPreImage: encryptedPreImage,
      meta: meta || {},
      paymentId: paymentId,
      receiverIdentifier: recipient,
      senderIdentifier: senderApp.initiatorIdentifier,
      status,
    };
  }

  async getPendingTransfers(
    userIdentifier: string,
  ): Promise<NodeResponses.GetPendingAsyncTransfers> {
    const transfers = await this.linkedTransferService.getLinkedTransfersForReceiverUnlock(
      userIdentifier,
    );
    return transfers.map((transfer) => {
      return {
        paymentId: transfer.meta.paymentId,
        createdAt: transfer.createdAt,
        amount: transfer.latestState.coinTransfers[0].amount,
        assetId: transfer.initiatorDepositAssetId,
        senderIdentifier: transfer.channel.userIdentifier,
        receiverIdentifier: transfer.meta.recipient,
        status: LinkedTransferStatus.PENDING,
        meta: transfer.meta,
        encryptedPreImage: transfer.meta.encryptedPreImage,
      };
    });
  }

  async setupSubscriptions(): Promise<void> {
    await super.connectRequestReponse(
      "*.transfer.get-linked",
      this.authService.parseIdentifier(this.getLinkedTransferByPaymentId.bind(this)),
    );
    // await super.connectRequestReponse(
    //   "*.transfer.get-pending",
    //   this.authService.parseIdentifier(this.getPendingTransfers.bind(this)),
    // );
  }
}

export const linkedTransferProviderFactory: FactoryProvider<Promise<void>> = {
  inject: [AuthService, LoggerService, MessagingProviderId, LinkedTransferService],
  provide: LinkedTransferProviderId,
  useFactory: async (
    authService: AuthService,
    logging: LoggerService,
    messaging: MessagingService,
    linkedTransferService: LinkedTransferService,
  ): Promise<void> => {
    const transfer = new LinkedTransferMessaging(
      authService,
      logging,
      messaging,
      linkedTransferService,
    );
    await transfer.setupSubscriptions();
  },
};
