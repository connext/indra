import { MessagingService } from "@connext/messaging";
import {
  NodeResponses,
  SimpleLinkedTransferAppName,
  SimpleSignedTransferAppName,
  ConditionalTransferTypes,
  getTransferTypeFromAppName,
  LinkedTransferStatus,
} from "@connext/types";
import { FactoryProvider } from "@nestjs/common/interfaces";

import { AuthService } from "../auth/auth.service";
import { LoggerService } from "../logger/logger.service";
import { MessagingProviderId, TransferProviderId } from "../constants";
import { AbstractMessagingProvider } from "../messaging/abstract.provider";
import { LinkedTransferService } from "../linkedTransfer/linkedTransfer.service";
import { RpcException } from "@nestjs/microservices";
import { stringify } from "@connext/utils";
import { TransferService } from "./transfer.service";

export class TransferMessaging extends AbstractMessagingProvider {
  constructor(
    private readonly authService: AuthService,
    log: LoggerService,
    messaging: MessagingService,
    private readonly linkedTransferService: LinkedTransferService,
    private readonly transferService: TransferService,
  ) {
    super(log, messaging);
    this.log.setContext("TransferMessaging");
  }

  async getTransferHistory(pubId: string): Promise<NodeResponses.GetTransferHistory> {
    throw new Error("Unimplemented");
  }

  /**
   * Check in endpoint for client to call when it comes online to handle pending tasks
   * @param userIdentifier
   */
  async clientCheckIn(userIdentifier: string): Promise<void> {
    // reclaim collateral from redeemed transfers
    await this.linkedTransferService.unlockLinkedTransfersFromUser(userIdentifier);
  }

  async resolveLinkedTransfer(
    pubId: string,
    { paymentId }: { paymentId: string },
  ): Promise<NodeResponses.ResolveLinkedTransfer> {
    this.log.debug(`Got resolve link request with data: ${stringify(paymentId)}`);
    if (!paymentId) {
      throw new RpcException(`Incorrect data received. Data: ${JSON.stringify(paymentId)}`);
    }

    const response = await this.transferService.resolveByPaymentId(
      pubId,
      paymentId,
      SimpleLinkedTransferAppName,
    );
    return {
      ...response,
      amount: response.amount,
    };
  }

  async resolveSignedTransfer(
    pubId: string,
    data: { paymentId: string },
  ): Promise<NodeResponses.ResolveSignedTransfer> {
    if (!data.paymentId) {
      throw new RpcException(`Incorrect data received. Data: ${JSON.stringify(data)}`);
    }
    this.log.info(`Got resolve signed transfer request with paymentId: ${data.paymentId}`);

    const response = await this.transferService.resolveByPaymentId(
      pubId,
      data.paymentId,
      SimpleSignedTransferAppName,
    );
    return {
      ...response,
      amount: response.amount,
    };
  }

  async installPendingTransfers(
    userIdentifier: string,
  ): Promise<NodeResponses.GetPendingAsyncTransfers> {
    const transfers = await this.linkedTransferService.getLinkedTransfersForReceiverUnlock(
      userIdentifier,
    );
    for (const transfer of transfers) {
      await this.transferService.resolveByPaymentId(
        userIdentifier,
        transfer.meta.paymentId,
        ConditionalTransferTypes.LinkedTransfer,
      );
    }
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

  async installConditionalTransferReceiverApp(
    pubId: string,
    data: { paymentId: string; conditionType: ConditionalTransferTypes },
  ): Promise<NodeResponses.InstallConditionalTransferReceiverApp> {
    if (!data.paymentId || !data.conditionType) {
      throw new RpcException(`Incorrect data received. Data: ${JSON.stringify(data)}`);
    }
    const transferType = getTransferTypeFromAppName(data.conditionType);
    if (transferType !== "AllowOffline") {
      throw new Error(`Only AllowOffline apps are able to be installed through node API`);
    }
    this.log.info(`Got installReceiverApp request with paymentId: ${data.paymentId}`);

    const response = await this.transferService.resolveByPaymentId(
      pubId,
      data.paymentId,
      data.conditionType,
    );
    return {
      ...response,
      amount: response.amount,
    };
  }

  async setupSubscriptions(): Promise<void> {
    await super.connectRequestReponse(
      "*.transfer.get-history",
      this.authService.parseIdentifier(this.getTransferHistory.bind(this)),
    );

    await super.connectRequestReponse(
      "*.transfer.install-linked",
      this.authService.parseIdentifier(this.resolveLinkedTransfer.bind(this)),
    );

    await super.connectRequestReponse(
      "*.transfer.install-signed",
      this.authService.parseIdentifier(this.resolveSignedTransfer.bind(this)),
    );

    await super.connectRequestReponse(
      "*.client.check-in",
      this.authService.parseIdentifier(this.clientCheckIn.bind(this)),
    );

    await super.connectRequestReponse(
      "*.transfer.install-receiver",
      this.authService.parseIdentifier(this.installConditionalTransferReceiverApp.bind(this)),
    );

    await super.connectRequestReponse(
      "*.transfer.install-pending",
      this.authService.parseIdentifier(this.installPendingTransfers.bind(this)),
    );
  }
}

export const transferProviderFactory: FactoryProvider<Promise<void>> = {
  inject: [AuthService, LoggerService, MessagingProviderId, LinkedTransferService, TransferService],
  provide: TransferProviderId,
  useFactory: async (
    authService: AuthService,
    logging: LoggerService,
    messaging: MessagingService,
    linkedTransferService: LinkedTransferService,
    transferService: TransferService,
  ): Promise<void> => {
    const transfer = new TransferMessaging(
      authService,
      logging,
      messaging,
      linkedTransferService,
      transferService,
    );
    await transfer.setupSubscriptions();
  },
};
