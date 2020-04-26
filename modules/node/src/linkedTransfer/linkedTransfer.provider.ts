import { MessagingService } from "@connext/messaging";
import {
  LinkedTransferStatus,
  NodeResponses,
  SimpleLinkedTransferAppState,
} from "@connext/types";
import { bigNumberifyJson, stringify } from "@connext/utils";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { RpcException } from "@nestjs/microservices";

import { AuthService } from "../auth/auth.service";
import { ConfigService } from "../config/config.service";
import { LoggerService } from "../logger/logger.service";
import { MessagingProviderId, LinkedTransferProviderId } from "../constants";
import { AbstractMessagingProvider } from "../messaging/abstract.provider";

import { LinkedTransferService } from "./linkedTransfer.service";

export class LinkedTransferMessaging extends AbstractMessagingProvider {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
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
      amount: latestState.amount,
      assetId: latestState.assetId,
      createdAt: senderApp.createdAt,
      encryptedPreImage: encryptedPreImage,
      meta: meta || {},
      paymentId: latestState.paymentId,
      receiverIdentifier: recipient,
      senderIdentifier: senderApp.initiatorIdentifier,
      status,
    };
  }

  async resolveLinkedTransfer(
    pubId: string,
    { paymentId }: { paymentId: string },
  ): Promise<NodeResponses.ResolveLinkedTransfer> {
    this.log.debug(
      `Got resolve link request with data: ${stringify(paymentId)}`,
    );
    if (!paymentId) {
      throw new RpcException(`Incorrect data received. Data: ${JSON.stringify(paymentId)}`);
    }
    const response = await this.linkedTransferService.installLinkedTransferReceiverApp(pubId, paymentId);
    return {
      ...response,
      amount: response.amount,
    };
  }

  async getPendingTransfers(
    userIdentifier: string,
  ): Promise<NodeResponses.GetPendingAsyncTransfers> {
    const transfers = await this.linkedTransferService.getLinkedTransfersForReceiverUnlock(
      userIdentifier,
    );
    return transfers.map(transfer => {
      const state = bigNumberifyJson(transfer.latestState) as SimpleLinkedTransferAppState;
      return {
        paymentId: state.paymentId,
        createdAt: transfer.createdAt,
        amount: state.amount,
        assetId: state.assetId,
        senderIdentifier: transfer.channel.userIdentifier,
        receiverIdentifier: transfer.meta["recipient"],
        status: LinkedTransferStatus.PENDING,
        meta: transfer.meta,
        encryptedPreImage: transfer.meta["encryptedPreImage"],
      };
    });
  }

  async setupSubscriptions(): Promise<void> {
    const publicIdentifier = this.configService.getPublicIdentifier();
    await super.connectRequestReponse(
      `*.${publicIdentifier}.transfer.get-linked`,
      this.authService.parseIdentifier(this.getLinkedTransferByPaymentId.bind(this)),
    );
    await super.connectRequestReponse(
      `*.${publicIdentifier}.transfer.install-linked`,
      this.authService.parseIdentifier(this.resolveLinkedTransfer.bind(this)),
    );
    await super.connectRequestReponse(
      `*.${publicIdentifier}.transfer.get-pending`,
      this.authService.parseIdentifier(this.getPendingTransfers.bind(this)),
    );
  }
}

export const linkedTransferProviderFactory: FactoryProvider<Promise<void>> = {
  inject: [AuthService, ConfigService, LoggerService, MessagingProviderId, LinkedTransferService],
  provide: LinkedTransferProviderId,
  useFactory: async (
    authService: AuthService,
    configService: ConfigService,
    logging: LoggerService,
    messaging: MessagingService,
    linkedTransferService: LinkedTransferService,
  ): Promise<void> => {
    const transfer = new LinkedTransferMessaging(
      authService,
      configService,
      logging,
      messaging,
      linkedTransferService,
    );
    await transfer.setupSubscriptions();
  },
};
